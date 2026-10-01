"use client";

import { memo, Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { FBXLoader, GLTFLoader } from "three-stdlib";
import { VRM, VRMLoaderPlugin, VRMUtils, type VRMHumanBoneName } from "@pixiv/three-vrm";

const TARGET_FPS = 30;
const FRAME_INTERVAL = 1 / TARGET_FPS;

if (typeof window !== "undefined") {
  const originalWarn = console.warn.bind(console);
  console.warn = (...args: any[]) => {
    const msg = typeof args[0] === "string" ? args[0] : "";
    if (msg.includes("THREE.Clock")) return;
    if (msg.includes("X4122")) return;
    if (msg.includes("THREE.WebGLProgram")) return;
    originalWarn(...args);
  };
}

type AvatarState = "idle" | "speaking" | "thinking" | "listening";

interface AvatarConfig {
  url: string;
  yOffset: number;
  scale: number;
  posX: number;
  posY: number;
  camY: number;
  camZ: number;
  fov: number;
}

interface AIAvatar3DProps {
  state?: AvatarState;
  mood?: string;
  gender?: string;
  /** Shared mutable ref for phoneme-based lip sync. Updated by useTTS. */
  visemeRef?: React.MutableRefObject<{ shape: string; intensity: number }>;
}

interface AvatarModelProps {
  state: AvatarState;
  mood?: string;
  gender?: string;
  enableBlinking: boolean;
  enableLipSync: boolean;
  enableMoods: boolean;
  visemeRef?: React.MutableRefObject<{ shape: string; intensity: number }>;
}

const AVATAR_CONFIGS: Record<string, AvatarConfig> = {
  M: {
    url: "/3d/m1.vrm",
    yOffset: -1.4,
    scale: 1.03,
    posX: 0.02,
    posY: -0.07,
    camY: 0.1,
    camZ: 0.95,
    fov: 45,
  },
  F: {
    url: "/3d/f1.vrm",
    yOffset: -1.6,
    scale: 1.03,
    posX: -0.01,
    posY: -0.07,
    camY: 0.04,
    camZ: 1.44,
    fov: 40,
  },
};

const ANIMATION_URLS: Record<string, Record<AvatarState, string>> = {
  M: {
    idle: "/animations/male/idle.fbx",
    listening: "/animations/male/listening.fbx",
    speaking: "/animations/male/speaking.fbx",
    thinking: "/animations/male/thinking.fbx",
  },
  F: {
    idle: "/animations/female/idle.fbx",
    listening: "/animations/female/listening.fbx",
    speaking: "/animations/female/speaking.fbx",
    thinking: "/animations/female/thinking.fbx",
  },
};

const mixamoVRMRigMap: Record<string, VRMHumanBoneName> = {
  mixamorigHips: "hips",
  mixamorigSpine: "spine",
  mixamorigSpine1: "chest",
  mixamorigSpine2: "upperChest",
  mixamorigNeck: "neck",
  mixamorigHead: "head",
  mixamorigLeftShoulder: "leftShoulder",
  mixamorigLeftArm: "leftUpperArm",
  mixamorigLeftForeArm: "leftLowerArm",
  mixamorigLeftHand: "leftHand",
  mixamorigLeftHandThumb1: "leftThumbMetacarpal",
  mixamorigLeftHandThumb2: "leftThumbProximal",
  mixamorigLeftHandThumb3: "leftThumbDistal",
  mixamorigLeftHandIndex1: "leftIndexProximal",
  mixamorigLeftHandIndex2: "leftIndexIntermediate",
  mixamorigLeftHandIndex3: "leftIndexDistal",
  mixamorigLeftHandMiddle1: "leftMiddleProximal",
  mixamorigLeftHandMiddle2: "leftMiddleIntermediate",
  mixamorigLeftHandMiddle3: "leftMiddleDistal",
  mixamorigLeftHandRing1: "leftRingProximal",
  mixamorigLeftHandRing2: "leftRingIntermediate",
  mixamorigLeftHandRing3: "leftRingDistal",
  mixamorigLeftHandPinky1: "leftLittleProximal",
  mixamorigLeftHandPinky2: "leftLittleIntermediate",
  mixamorigLeftHandPinky3: "leftLittleDistal",
  mixamorigRightShoulder: "rightShoulder",
  mixamorigRightArm: "rightUpperArm",
  mixamorigRightForeArm: "rightLowerArm",
  mixamorigRightHand: "rightHand",
  mixamorigRightHandThumb1: "rightThumbMetacarpal",
  mixamorigRightHandThumb2: "rightThumbProximal",
  mixamorigRightHandThumb3: "rightThumbDistal",
  mixamorigRightHandIndex1: "rightIndexProximal",
  mixamorigRightHandIndex2: "rightIndexIntermediate",
  mixamorigRightHandIndex3: "rightIndexDistal",
  mixamorigRightHandMiddle1: "rightMiddleProximal",
  mixamorigRightHandMiddle2: "rightMiddleIntermediate",
  mixamorigRightHandMiddle3: "rightMiddleDistal",
  mixamorigRightHandRing1: "rightRingProximal",
  mixamorigRightHandRing2: "rightRingIntermediate",
  mixamorigRightHandRing3: "rightRingDistal",
  mixamorigRightHandPinky1: "rightLittleProximal",
  mixamorigRightHandPinky2: "rightLittleIntermediate",
  mixamorigRightHandPinky3: "rightLittleDistal",
  mixamorigLeftUpLeg: "leftUpperLeg",
  mixamorigLeftLeg: "leftLowerLeg",
  mixamorigLeftFoot: "leftFoot",
  mixamorigLeftToeBase: "leftToes",
  mixamorigRightUpLeg: "rightUpperLeg",
  mixamorigRightLeg: "rightLowerLeg",
  mixamorigRightFoot: "rightFoot",
  mixamorigRightToeBase: "rightToes",
};

const normalizeMixamoRigName = (name: string) => {
  if (name.startsWith("mixamorig:")) return name.replace("mixamorig:", "mixamorig");
  return name;
};

const setExpression = (vrm: VRM, name: string, value: number) => {
  vrm.expressionManager?.setValue(name, THREE.MathUtils.clamp(value, 0, 1));
};

const applyNaturalRestPose = (vrm: VRM) => {
  if (!vrm?.humanoid) return;
  const lUpperArm = vrm.humanoid.getNormalizedBoneNode("leftUpperArm");
  const rUpperArm = vrm.humanoid.getNormalizedBoneNode("rightUpperArm");
  const lLowerArm = vrm.humanoid.getNormalizedBoneNode("leftLowerArm");
  const rLowerArm = vrm.humanoid.getNormalizedBoneNode("rightLowerArm");
  const lHand = vrm.humanoid.getNormalizedBoneNode("leftHand");
  const rHand = vrm.humanoid.getNormalizedBoneNode("rightHand");

  // Lower arms from horizontal T-pose down along sides in natural relaxed standing posture
  if (lUpperArm) {
    lUpperArm.rotation.set(0.08, 0.05, -1.25);
    lUpperArm.quaternion.setFromEuler(lUpperArm.rotation);
  }
  if (rUpperArm) {
    rUpperArm.rotation.set(0.08, -0.05, 1.25);
    rUpperArm.quaternion.setFromEuler(rUpperArm.rotation);
  }
  if (lLowerArm) {
    lLowerArm.rotation.set(0, -0.2, -0.15);
    lLowerArm.quaternion.setFromEuler(lLowerArm.rotation);
  }
  if (rLowerArm) {
    rLowerArm.rotation.set(0, 0.2, 0.15);
    rLowerArm.quaternion.setFromEuler(rLowerArm.rotation);
  }
  if (lHand) {
    lHand.rotation.set(0, 0, 0);
    lHand.quaternion.setFromEuler(lHand.rotation);
  }
  if (rHand) {
    rHand.rotation.set(0, 0, 0);
    rHand.quaternion.setFromEuler(rHand.rotation);
  }
  vrm.humanoid.update();
  vrm.update(0);
};

// Global cache for loaded FBX animation assets to prevent network re-downloads and lag
const globalFbxAssetCache = new Map<string, Promise<THREE.Group>>();

function getFbxAsset(url: string): Promise<THREE.Group> {
  if (!globalFbxAssetCache.has(url)) {
    const loader = new FBXLoader();
    globalFbxAssetCache.set(url, loader.loadAsync(url));
  }
  return globalFbxAssetCache.get(url)!;
}

async function loadMixamoAnimation(url: string, vrm: VRM) {
  const asset = await getFbxAsset(url);
  const sourceClip =
    THREE.AnimationClip.findByName(asset.animations, "mixamo.com") ??
    asset.animations[0];

  if (!sourceClip) {
    throw new Error(`No animation clip found in ${url}`);
  }

  const tracks: THREE.KeyframeTrack[] = [];
  const restRotationInverse = new THREE.Quaternion();
  const parentRestWorldRotation = new THREE.Quaternion();
  const quat = new THREE.Quaternion();

  const hips = asset.getObjectByName("mixamorigHips") ?? asset.getObjectByName("mixamorig:Hips");
  const motionHipsHeight = Math.max(Math.abs(hips?.position.y ?? 1), 0.001);
  const vrmRestHipsY = vrm.humanoid.normalizedRestPose.hips?.position?.[1];
  const vrmRuntimeHipsY = vrm.humanoid.getNormalizedBoneNode("hips")?.position.y;
  const vrmHipsHeight = Math.max(Math.abs(vrmRestHipsY ?? vrmRuntimeHipsY ?? 1), 0.001);
  const hipsPositionScale = vrmHipsHeight / motionHipsHeight;

  sourceClip.tracks.forEach((track) => {
    const [rawRigName, propertyName] = track.name.split(".");
    const mixamoRigName = normalizeMixamoRigName(rawRigName);
    const vrmBoneName = mixamoVRMRigMap[mixamoRigName];
    if (!vrmBoneName || !propertyName) return;

    const vrmNodeName = vrm.humanoid.getNormalizedBoneNode(vrmBoneName)?.name;
    const mixamoRigNode =
      asset.getObjectByName(rawRigName) ?? asset.getObjectByName(mixamoRigName);

    if (!vrmNodeName || !mixamoRigNode || !mixamoRigNode.parent) return;

    mixamoRigNode.getWorldQuaternion(restRotationInverse).invert();
    mixamoRigNode.parent.getWorldQuaternion(parentRestWorldRotation);

    if (track instanceof THREE.QuaternionKeyframeTrack) {
      const values = Array.from(track.values);

      for (let i = 0; i < values.length; i += 4) {
        quat.fromArray(values, i);
        quat.premultiply(parentRestWorldRotation).multiply(restRotationInverse);
        quat.toArray(values, i);
      }

      tracks.push(
        new THREE.QuaternionKeyframeTrack(
          `${vrmNodeName}.${propertyName}`,
          track.times,
          values.map((value, index) =>
            vrm.meta?.metaVersion === "0" && index % 2 === 0 ? -value : value,
          ),
        ),
      );
    }

    if (track instanceof THREE.VectorKeyframeTrack) {
      tracks.push(
        new THREE.VectorKeyframeTrack(
          `${vrmNodeName}.${propertyName}`,
          track.times,
          Array.from(track.values).map(
            (value, index) =>
              (vrm.meta?.metaVersion === "0" && index % 3 !== 1 ? -value : value) *
              hipsPositionScale,
          ),
        ),
      );
    }
  });

  return new THREE.AnimationClip(url, sourceClip.duration, tracks);
}

// ─── Expression keys managed by the lerp system ───────────────────────────────
const EXPR_KEYS = [
  "blink", "aa", "ih", "ou", "ee", "oh", "pp", "ff",
  "happy", "relaxed", "angry", "sad", "surprised",
] as const;
type ExprKey = typeof EXPR_KEYS[number];
type ExprMap = Record<ExprKey, number>;

const zeroExprMap = (): ExprMap =>
  Object.fromEntries(EXPR_KEYS.map((k) => [k, 0])) as ExprMap;

function AvatarModel({
  state,
  mood = "neutral",
  gender = "M",
  enableBlinking,
  enableLipSync,
  enableMoods,
  visemeRef,
}: AvatarModelProps) {
  const { camera } = useThree();
  const config = AVATAR_CONFIGS[gender] || AVATAR_CONFIGS.M;
  const animationUrls = ANIMATION_URLS[gender] || ANIMATION_URLS.M;
  const gltf = useLoader(GLTFLoader, config.url, (loader) => {
    loader.crossOrigin = "anonymous";
    loader.register((parser: any) => new VRMLoaderPlugin(parser) as any);
  });

  const [vrm, setVrm] = useState<VRM | null>(null);
  const [animationsReady, setAnimationsReady] = useState(false);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<Partial<Record<AvatarState, THREE.AnimationAction>>>({});
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);

  // Smooth expression state
  const exprTargetRef = useRef<ExprMap>(zeroExprMap());
  const exprCurrentRef = useRef<ExprMap>(zeroExprMap());

  // Blink animation progress (0 = not blinking, 0-1 = mid-blink)
  const blinkPhaseRef = useRef(0);
  const blinkTimer = useRef(2.5);

  const clockRef = useRef(0);
  const gestureRef = useRef({ nextAt: 0, startedAt: 0, side: 1, active: false });

  // ── Load VRM ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!gltf?.userData?.vrm) return;
    const nextVrm = gltf.userData.vrm as VRM;
    VRMUtils.removeUnnecessaryVertices(gltf.scene);
    VRMUtils.combineSkeletons(gltf.scene);
    nextVrm.scene.rotation.y = Math.PI;

    // Apply natural resting pose immediately so avatar never displays in T-pose
    applyNaturalRestPose(nextVrm);
    // Hide avatar scene initially to prevent T-pose flash before animation clips load
    nextVrm.scene.visible = false;
    setVrm(nextVrm);
  }, [gltf, config.url]);

  // ── Eye contact: aim avatar's gaze at the camera ────────────────────────────
  useEffect(() => {
    if (!vrm?.lookAt) return;
    vrm.lookAt.target = camera;
    return () => {
      if (vrm?.lookAt) vrm.lookAt.target = undefined as any;
    };
  }, [vrm, camera]);

  // ── Load animations ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!vrm) return;
    const currentVrm = vrm;
    let cancelled = false;
    setAnimationsReady(false);
    currentVrm.scene.visible = false;
    mixerRef.current?.stopAllAction();
    actionsRef.current = {};
    currentActionRef.current = null;

    async function setupAnimations() {
      try {
        const mixer = new THREE.AnimationMixer(currentVrm.scene);
        mixerRef.current = mixer;

        // 1. Load primary animation first so character starts moving right away
        const primaryKey: AvatarState = state in animationUrls ? state : "idle";
        const primaryClip = await loadMixamoAnimation(animationUrls[primaryKey], currentVrm);
        if (cancelled) {
          mixer.stopAllAction();
          return;
        }

        const primaryAction = mixer.clipAction(primaryClip);
        primaryAction.enabled = true;
        primaryAction.setLoop(THREE.LoopRepeat, Infinity);
        primaryAction.clampWhenFinished = false;
        // Instantly activate natural pose at full weight with zero T-pose blending
        primaryAction.reset().setEffectiveWeight(1).play();
        mixer.update(0);
        currentVrm.update(0);
        // Force frame-0 pose update before revealing mesh to eliminate T-pose completely
        currentVrm.scene.visible = true;

        actionsRef.current[primaryKey] = primaryAction;
        currentActionRef.current = primaryAction;
        setAnimationsReady(true);

        // 2. Preload remaining animations in background
        const remainingKeys = (Object.keys(animationUrls) as AvatarState[]).filter(
          (k) => k !== primaryKey
        );

        await Promise.all(
          remainingKeys.map(async (key) => {
            if (cancelled) return;
            try {
              const clip = await loadMixamoAnimation(animationUrls[key], currentVrm);
              if (cancelled) return;
              const action = mixer.clipAction(clip);
              action.enabled = true;
              action.setLoop(THREE.LoopRepeat, Infinity);
              action.clampWhenFinished = false;
              actionsRef.current[key] = action;
            } catch (err) {
              console.warn(`Failed to preload animation ${key}:`, err);
            }
          })
        );
      } catch (error) {
        console.error("Failed to load Mixamo FBX animations:", error);
      }
    }

    setupAnimations();

    return () => {
      cancelled = true;
      mixerRef.current?.stopAllAction();
      mixerRef.current = null;
      actionsRef.current = {};
      currentActionRef.current = null;
    };
  }, [vrm, animationUrls]);

  // ── State → animation crossfade (smooth 0.35s) ────────────────────────────
  useEffect(() => {
    if (!animationsReady) return;
    const nextAction = actionsRef.current[state] ?? actionsRef.current.idle;
    const currentAction = currentActionRef.current;
    if (!nextAction || nextAction === currentAction) return;

    nextAction.enabled = true;
    nextAction.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(0.35).play();
    currentAction?.fadeOut(0.35);
    currentActionRef.current = nextAction;
  }, [animationsReady, state]);

  const frameAccRef = useRef(0);
  const restPoseAppliedRef = useRef(false);

  // Throttled invalidation loop at ~30fps
  const { invalidate: inv } = useThree();
  useEffect(() => {
    let handle: number;
    const tick = () => {
      inv();
      handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, [inv]);

  // ── Per-frame: expressions + micro-movements ─────────────────────────────
  useFrame((_, rawDelta) => {
    // Accumulate time and skip frames to throttle to ~30fps
    frameAccRef.current += rawDelta;
    if (frameAccRef.current < FRAME_INTERVAL) return;
    const delta = frameAccRef.current;
    frameAccRef.current = 0;

    clockRef.current += delta;
    const t = clockRef.current;

    // While FBX animations are still loading, keep avatar in natural resting pose with breathing
    if (!animationsReady) {
      if (vrm?.humanoid) {
        if (!restPoseAppliedRef.current) {
          applyNaturalRestPose(vrm);
          restPoseAppliedRef.current = true;
        }
        const spine = vrm.humanoid.getNormalizedBoneNode("spine");
        const chest = vrm.humanoid.getNormalizedBoneNode("chest");
        if (spine) spine.rotation.x = Math.sin(t * 1.4) * 0.012;
        if (chest) chest.rotation.x = Math.sin(t * 1.4 + 0.3) * 0.015;
        vrm.update(delta);
      }
      return;
    }

    mixerRef.current?.update(delta);
    vrm?.update(delta);

    if (!vrm) return;

    // #5 - Eye contact: update gaze lookAt target frame-by-frame
    if (vrm.lookAt) {
      vrm.lookAt.update(delta);
    }

    // ── 1. Smooth Blinking (#2 + #3) ──────────────────────────────────────────
    if (enableBlinking) {
      blinkTimer.current -= delta;
      if (blinkTimer.current <= 0) {
        // Thinking state: blink less often (focused gaze)
        const pause = state === "thinking" ? Math.random() * 3 + 4.5 : Math.random() * 2.5 + 2.0;
        blinkTimer.current = pause;
        blinkPhaseRef.current = 0.001; // start a blink
      }

      if (blinkPhaseRef.current > 0) {
        // Natural blink speed: ~180ms total open-close curve (delta * 5.5)
        blinkPhaseRef.current = Math.min(1, blinkPhaseRef.current + delta * 5.5);
        // Sine arch: 0 → 1 → 0 = smooth eyelids
        exprTargetRef.current.blink = Math.sin(blinkPhaseRef.current * Math.PI);

        if (blinkPhaseRef.current >= 1) {
          // 15% chance of double blink for extra realism
          if (Math.random() < 0.15 && blinkTimer.current > 1.0) {
            blinkPhaseRef.current = 0.001;
            blinkTimer.current = 0.25;
          } else {
            blinkPhaseRef.current = 0;
          }
        }
      } else {
        exprTargetRef.current.blink = 0;
      }
    } else {
      exprTargetRef.current.blink = 0;
    }

    // ── 2. Phoneme Lip Sync ───────────────────────────────────────────────────
    // Zero out mouth shapes first
    exprTargetRef.current.aa = 0;
    exprTargetRef.current.ih = 0;
    exprTargetRef.current.ou = 0;
    exprTargetRef.current.ee = 0;
    exprTargetRef.current.oh = 0;
    exprTargetRef.current.pp = 0;
    exprTargetRef.current.ff = 0;

    if (enableLipSync && state === "speaking") {
      const viseme = visemeRef?.current ?? { shape: "rest", intensity: 0 };
      if (viseme.shape !== "rest" && viseme.shape in exprTargetRef.current) {
        (exprTargetRef.current as any)[viseme.shape] = viseme.intensity;
      }
    }

    // ── 3. Mood Mismatch Fix (#1) ─────────────────────────────────────────────
    if (enableMoods) {
      const m = (mood || "neutral").toLowerCase();

      // happy: excited > positive > interested > curious > base speech warmth
      exprTargetRef.current.happy =
        m === "excited"    ? 0.70 :
        m === "positive"   ? 0.45 :
        m === "interested" ? 0.38 :
        m === "curious"    ? 0.22 :
        (state === "speaking" || state === "listening") ? 0.10 : 0;

      // relaxed: gentle facial tone for positive, interested, curious, neutral
      exprTargetRef.current.relaxed =
        m === "positive"   ? 0.30 :
        m === "interested" ? 0.25 :
        m === "curious"    ? 0.28 :
        m === "neutral"    ? 0.15 : 0;

      // angry: stern / negative reaction
      exprTargetRef.current.angry =
        m === "negative"   ? 0.40 :
        m === "skeptical"  ? 0.18 : 0;

      // sad: skeptical or negative mood
      exprTargetRef.current.sad =
        m === "skeptical"  ? 0.35 :
        m === "negative"   ? 0.25 :
        state === "thinking" ? 0.12 : 0;

      // surprised: curious or excited mood accent
      exprTargetRef.current.surprised =
        m === "curious"    ? 0.15 :
        m === "excited"    ? 0.20 : 0;
    } else {
      exprTargetRef.current.happy     = 0;
      exprTargetRef.current.relaxed   = 0;
      exprTargetRef.current.angry     = 0;
      exprTargetRef.current.sad       = 0;
      exprTargetRef.current.surprised = 0;
    }

    // ── 4. Instant Mouth Closing & Viseme Lerp (#2 + #3) ──────────────────────
    const MOUTH_KEYS = ["aa", "ih", "ou", "ee", "oh", "pp", "ff"] as const;
    type MouthKey = typeof MOUTH_KEYS[number];
    const mouthKeySet = new Set<string>(MOUTH_KEYS);
    const visemeActive = state === "speaking" && visemeRef?.current?.shape !== "rest";
    const exprLerpFactor = Math.min(1, 8 * delta);

    // If audio is at rest or not speaking, instantly kill all mouth blendshapes & clamp jaw bone
    if (!visemeActive) {
      for (const key of MOUTH_KEYS) {
        exprCurrentRef.current[key as MouthKey] = 0;
        exprTargetRef.current[key as MouthKey] = 0;
        setExpression(vrm, key, 0);
      }
      const jaw = vrm.humanoid?.getNormalizedBoneNode("jaw" as VRMHumanBoneName);
      if (jaw) {
        jaw.rotation.x = THREE.MathUtils.lerp(jaw.rotation.x, 0, delta * 30);
      }
    } else {
      const mouthLerpFactor = Math.min(1, 28 * delta);
      for (const key of MOUTH_KEYS) {
        const target  = exprTargetRef.current[key as MouthKey];
        const current = exprCurrentRef.current[key as MouthKey];
        const next    = THREE.MathUtils.lerp(current, target, mouthLerpFactor);
        exprCurrentRef.current[key as MouthKey] = next;
        setExpression(vrm, key, next);
      }
    }

    // Lerp non-mouth facial expressions (happy, angry, sad, etc.)
    const nonMouthKeys = EXPR_KEYS.filter((k) => !mouthKeySet.has(k));
    for (const key of nonMouthKeys) {
      const target  = exprTargetRef.current[key];
      const current = exprCurrentRef.current[key];
      const next    = THREE.MathUtils.lerp(current, target, exprLerpFactor);
      exprCurrentRef.current[key] = next;
      setExpression(vrm, key, next);
    }

    // ── 5. Organic Micro Movements (#6 + #11) ──────────────────────────────────
    const head  = vrm.humanoid?.getNormalizedBoneNode("head" as VRMHumanBoneName);
    const neck  = vrm.humanoid?.getNormalizedBoneNode("neck" as VRMHumanBoneName);
    const spine = vrm.humanoid?.getNormalizedBoneNode("spine" as VRMHumanBoneName);

    // Add subtle motion on top of the sampled FBX pose; these bones are keyed in every clip.
    if (spine) spine.rotation.x += Math.sin(t * 1.5) * 0.008;

    if (head) {
      const { x, y, z } = head.rotation;
      let offsetX = 0;
      let offsetY = 0;
      let offsetZ = 0;
      if (state === "idle") {
        offsetY = Math.sin(t * 0.35) * 0.018 + Math.sin(t * 0.11) * 0.01;
        offsetX = Math.sin(t * 0.27 + 1.1) * 0.01;
        offsetZ = Math.sin(t * 0.19 + 0.5) * 0.008;
      } else if (state === "thinking") {
        offsetY = Math.sin(t * 0.22) * 0.025;
        offsetX = -0.025 - Math.sin(t * 0.16) * 0.012;
        offsetZ = Math.sin(t * 0.13) * 0.01;
      } else if (state === "speaking") {
        offsetY = Math.sin(t * 0.6) * 0.015;
        offsetX = Math.sin(t * 0.48 + 0.8) * 0.01;
        offsetZ = Math.sin(t * 0.32) * 0.006;
      }
      head.rotation.set(x + offsetX, y + offsetY, z + offsetZ);
    }

    if (neck) {
      if (state === "listening") {
        const nodPulse = Math.pow(Math.max(0, Math.sin(t * 1.8)), 3) * 0.025;
        neck.rotation.z += 0.018 + Math.sin(t * 0.45) * 0.008;
        neck.rotation.x += nodPulse + Math.sin(t * 0.32 + 0.5) * 0.008;
      }
    }

    if (state === "speaking") {
      const gesture = gestureRef.current;
      if (!gesture.active && t >= gesture.nextAt) {
        gesture.active = true;
        gesture.startedAt = t;
        gesture.side = Math.random() < 0.5 ? -1 : 1;
      }
      if (gesture.active) {
        const elapsed = t - gesture.startedAt;
        const weight = elapsed < 0.18 ? elapsed / 0.18 : Math.max(0, 1 - (elapsed - 0.18) / 0.62);
        const arm = vrm.humanoid?.getNormalizedBoneNode(gesture.side < 0 ? "leftUpperArm" : "rightUpperArm");
        if (arm) arm.rotation.z = arm.rotation.z - gesture.side * weight * 0.09;
        if (elapsed >= 0.8) {
          gesture.active = false;
          gesture.nextAt = t + 1.4 + Math.random() * 1.8;
        }
      }
    } else {
      gestureRef.current.active = false;
    }

    vrm.update(delta);
  });

  return (
    <group position={[0, config.yOffset, 0]} visible={animationsReady}>
      <primitive object={gltf.scene} />
    </group>
  );
}

function CameraUpdater({
  posX,
  camY,
  camZ,
  fov,
}: {
  posX: number;
  camY: number;
  camZ: number;
  fov: number;
}) {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(posX, camY, camZ);
    const perspective = camera as THREE.PerspectiveCamera;
    if (perspective.fov !== fov) {
      perspective.fov = fov;
      perspective.updateProjectionMatrix();
    }
  }, [camera, posX, camY, camZ, fov]);

  return null;
}

export const AIAvatar3D = memo(function AIAvatar3D({
  state = "idle",
  mood = "neutral",
  gender = "M",
  visemeRef,
}: AIAvatar3DProps) {
  const config = AVATAR_CONFIGS[gender] || AVATAR_CONFIGS.M;

  const scale = config.scale;
  const posX = config.posX;
  const posY = config.posY;
  const camY = config.camY;
  const camZ = config.camZ;
  const fov = config.fov;
  const bgColor = "#1c5f7b";

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <Canvas
        camera={{ position: [posX, camY, camZ], fov }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        dpr={[1, 1.5]}
        frameloop="demand"
        style={{ background: bgColor, width: "100%", height: "100%" }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[2, 4, 3]} intensity={1.4} />

        <CameraUpdater posX={posX} camY={camY} camZ={camZ} fov={fov} />

        <Suspense fallback={null}>
          <hemisphereLight args={["#b1e1ff", "#886644", 0.6]} />
          <group scale={[scale, scale, scale]} position={[posX, posY, 0]}>
            <AvatarModel
              state={state}
              mood={mood}
              gender={gender}
              enableBlinking={true}
              enableLipSync={true}
              enableMoods={true}
              visemeRef={visemeRef}
            />
          </group>
        </Suspense>
      </Canvas>
    </div>
  );
});
