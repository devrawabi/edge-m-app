import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Image, Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const MIN_SCALE = 1;
const MAX_SCALE = 4;

function clampScale(v: number) {
  'worklet';
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, v));
}

type NativeZoomProps = {
  uri: string;
  headers?: Record<string, string>;
};

/** Fullscreen-ish preview: pinch to zoom / pan when zoomed (iOS & Android). */
function ZoomablePreviewImageNative({ uri, headers }: NativeZoomProps) {
  const { width: winW, height: winH } = Dimensions.get('window');
  const imgH = Math.min(winH - 160, 720);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = clampScale(savedScale.value * e.scale);
    })
    .onEnd(() => {
      if (scale.value < MIN_SCALE) scale.value = MIN_SCALE;
      if (scale.value > MAX_SCALE) scale.value = MAX_SCALE;
      savedScale.value = scale.value;
      if (savedScale.value <= MIN_SCALE + 1e-3) {
        scale.value = withTiming(MIN_SCALE);
        savedScale.value = MIN_SCALE;
        tx.value = withTiming(0);
        ty.value = withTiming(0);
        savedTx.value = 0;
        savedTy.value = 0;
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (savedScale.value <= MIN_SCALE) return;
      tx.value = savedTx.value + e.translationX;
      ty.value = savedTy.value + e.translationY;
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const composed = Gesture.Simultaneous(pinch, pan);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <View style={styles.nativeShell}>
      <GestureDetector gesture={composed}>
        <Animated.View style={[styles.nativeInner, animStyle]}>
          <Image
            source={{ uri, ...(headers ? { headers } : {}) }}
            style={{ width: winW, height: imgH }}
            resizeMode="contain"
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

type WebZoomProps = { uri: string };

/** Pinch / wheel-zoom for web fullscreen image preview (non-passive listeners so preventDefault works). */
function ZoomablePreviewImageWeb({ uri }: WebZoomProps) {
  const { width: winW, height: winH } = Dimensions.get('window');
  const imgH = Math.min(winH - 160, 720);
  const [scale, setScale] = useState(1);
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const scaleRef = useRef(1);
  const xRef = useRef(0);
  const yRef = useRef(0);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef({ active: false, startX: 0, startY: 0, ox: 0, oy: 0 });
  const pinchRef = useRef({ dist: 0, startScale: 1 });

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);
  useEffect(() => {
    xRef.current = x;
    yRef.current = y;
  }, [x, y]);

  const clamp = useCallback((s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s)), []);

  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;

    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      setScale((prev) => clamp(prev + delta));
    };

    const onTouchStartNative = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const a = e.touches[0];
        const b = e.touches[1];
        const dx = a.clientX - b.clientX;
        const dy = a.clientY - b.clientY;
        pinchRef.current = { dist: Math.hypot(dx, dy), startScale: scaleRef.current };
      }
    };

    const onTouchMoveNative = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const a = e.touches[0];
        const b = e.touches[1];
        const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const ratio = pinchRef.current.dist ? dist / pinchRef.current.dist : 1;
        setScale(clamp(pinchRef.current.startScale * ratio));
      } else if (e.touches.length === 1 && drag.current.active && scaleRef.current > MIN_SCALE + 0.02) {
        const t = e.touches[0];
        setX(drag.current.ox + (t.clientX - drag.current.startX));
        setY(drag.current.oy + (t.clientY - drag.current.startY));
      }
    };

    const onTouchEndNative = () => {
      pinchRef.current = { dist: 0, startScale: scaleRef.current };
    };

    el.addEventListener('wheel', onWheelNative, { passive: false });
    el.addEventListener('touchstart', onTouchStartNative);
    el.addEventListener('touchmove', onTouchMoveNative, { passive: false });
    el.addEventListener('touchend', onTouchEndNative);

    return () => {
      el.removeEventListener('wheel', onWheelNative);
      el.removeEventListener('touchstart', onTouchStartNative);
      el.removeEventListener('touchmove', onTouchMoveNative);
      el.removeEventListener('touchend', onTouchEndNative);
    };
  }, [clamp, uri]);

  const webShellProps: any = {
    ref: shellRef as React.Ref<HTMLDivElement>,
    style: {
      flex: 1,
      overflow: 'hidden' as const,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      touchAction: 'none' as const,
    },
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      if ((e.buttons & 1) === 1 && scaleRef.current > MIN_SCALE + 0.02) {
        drag.current = {
          active: true,
          startX: e.clientX,
          startY: e.clientY,
          ox: xRef.current,
          oy: yRef.current,
        };
      }
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      if (drag.current.active && (e.buttons & 1) === 1) {
        setX(drag.current.ox + (e.clientX - drag.current.startX));
        setY(drag.current.oy + (e.clientY - drag.current.startY));
      }
    },
    onPointerUp: () => {
      drag.current.active = false;
    },
    onDoubleClick: () => {
      if (scaleRef.current > MIN_SCALE + 0.05) {
        setScale(1);
        setX(0);
        setY(0);
      } else {
        setScale(2.25);
      }
    },
  };

  return React.createElement(
    'div',
    webShellProps,
    React.createElement('img', {
      src: uri,
      alt: '',
      draggable: false,
      style: {
        width: winW,
        height: imgH,
        objectFit: 'contain' as const,
        transform: `translate(${x}px, ${y}px) scale(${scale})`,
        transformOrigin: 'center center',
      },
    }),
  );
}

type Props = {
  uri: string;
  headers?: Record<string, string>;
};

export function ZoomablePreviewImage({ uri, headers }: Props) {
  if (Platform.OS === 'web') {
    return <ZoomablePreviewImageWeb uri={uri} />;
  }
  return <ZoomablePreviewImageNative uri={uri} headers={headers} />;
}

const styles = StyleSheet.create({
  nativeShell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  nativeInner: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
