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
  const manager = vrm.expressionManager;
  if (!manager) return;
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  manager.setValue(name, clamped);
  if (name === "surprised" && (manager as any).expressionMap?.Surprised) {
    manager.setValue("Surprised", clamped);
  }
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
  "blink", "aa", "ih", "ou", "ee", "oh",
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

  // Natural eye saccades & dynamic gaze target
  const gazeTargetRef = useRef<THREE.Object3D | null>(null);
  if (!gazeTargetRef.current) {
    gazeTargetRef.current = new THREE.Object3D();
  }
  const saccadeOffset = useRef(new THREE.Vector3(0, 0, 0));
  const currentGazePos = useRef(new THREE.Vector3(0, 0, 0));
  const saccadeTimer = useRef(1.5);

  // TimeScale micro-wandering to break periodic metronome loops
  const timeScaleTargetRef = useRef(1.0);
  const timeScaleTimer = useRef(2.5);

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
    vrm.lookAt.target = gazeTargetRef.current;
    return () => {
      if (vrm?.lookAt) vrm.lookAt.target = undefined as any;
    };
  }, [vrm]);

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
              console.warn(`[Avatar3D] Failed to preload animation ${key} for gender ${gender}:`, err);
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
  }, [vrm, animationUrls, gender]);

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
  }, [animationsReady, state, gender]);

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

    // Continuous organic speed wandering to prevent metronome repetition
    const speedWander = 0.94 + Math.sin(t * 0.43) * 0.08 + Math.cos(t * 0.27) * 0.04;
    if (mixerRef.current) {
      mixerRef.current.timeScale = speedWander;
    }

    mixerRef.current?.update(delta);

    if (!vrm) return;

    // Procedural Saccades (organic micro eye-darts)
    saccadeTimer.current -= delta;
    if (saccadeTimer.current <= 0) {
      if (state === "thinking") {
        saccadeOffset.current.set(
          (Math.random() - 0.5) * 0.12 - 0.05,
          0.04 + Math.random() * 0.04,
          0
        );
        saccadeTimer.current = 2.0 + Math.random() * 2.5;
      } else if (state === "speaking") {
        saccadeOffset.current.set(
          (Math.random() - 0.5) * 0.05,
          (Math.random() - 0.5) * 0.03,
          0
        );
        saccadeTimer.current = 1.2 + Math.random() * 1.8;
      } else {
        saccadeOffset.current.set(
          (Math.random() - 0.5) * 0.04,
          (Math.random() - 0.5) * 0.02,
          0
        );
        saccadeTimer.current = 1.8 + Math.random() * 2.2;
      }
    }

    if (gazeTargetRef.current) {
      const targetVec = camera.position.clone().add(saccadeOffset.current);
      currentGazePos.current.lerp(targetVec, Math.min(1, 8 * delta));
      gazeTargetRef.current.position.copy(currentGazePos.current);
    }

    // Eye contact: update gaze lookAt target frame-by-frame
    if (vrm.lookAt) {
      vrm.lookAt.update(delta);
    }

    // ── 1. Smooth Blinking ────────────────────────────────────────────────────
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

    // ── 2. Natural Lip-Sync & Conversational Speech Cadence ─────────────────────
    // Zero out mouth targets first
    exprTargetRef.current.aa = 0;
    exprTargetRef.current.ih = 0;
    exprTargetRef.current.ou = 0;
    exprTargetRef.current.ee = 0;
    exprTargetRef.current.oh = 0;

    if (enableLipSync && state === "speaking") {
      const viseme = visemeRef?.current;
      const hasActivePhoneme = Boolean(viseme && viseme.shape !== "rest" && viseme.intensity > 0.05);

      if (hasActivePhoneme && viseme) {
        const shape = viseme.shape;
        const intensity = viseme.intensity;
        if (shape === "aa") {
          exprTargetRef.current.aa = intensity * 0.95;
        } else if (shape === "ih") {
          exprTargetRef.current.ih = intensity * 0.85;
          exprTargetRef.current.ee = intensity * 0.25;
        } else if (shape === "ou") {
          exprTargetRef.current.ou = intensity * 0.90;
        } else if (shape === "ee") {
          exprTargetRef.current.ee = intensity * 0.80;
          exprTargetRef.current.ih = intensity * 0.20;
        } else if (shape === "oh") {
          exprTargetRef.current.oh = intensity * 0.90;
        } else if (shape === "pp") {
          // Bilabial closure (m, b, p): lips compressed
          exprTargetRef.current.ee = 0.08 * intensity;
        } else if (shape === "ff") {
          // Labiodental (f, v): slight teeth exposure
          exprTargetRef.current.ee = 0.22 * intensity;
          exprTargetRef.current.ih = 0.15 * intensity;
        } else {
          exprTargetRef.current.aa = 0.45 * intensity;
        }
      } else {
        // Conversational speech cadence fallback (active during WebSpeech or pauses between phonemes)
        const s1 = Math.sin(t * 14.2) * 0.5 + 0.5;
        const s2 = Math.sin(t * 8.6 + 1.1) * 0.5 + 0.5;
        const s3 = Math.sin(t * 21.0) * 0.5 + 0.5;
        const rawCadence = s1 * 0.52 + s2 * 0.33 + s3 * 0.15;

        // Subtle conversational clause pause (~every 2.7s)
        const clausePhase = (t * 0.37) % 1;
        const isPause = clausePhase > 0.88;
        const cadenceAmp = isPause ? 0.04 : Math.min(0.85, rawCadence * 1.15);

        // Cyclic Indonesian & English vowel distribution
        const vPhase = (t * 3.6) % (Math.PI * 2);
        exprTargetRef.current.aa = Math.max(0, Math.sin(vPhase)) * 0.70 * cadenceAmp;
        exprTargetRef.current.oh = Math.max(0, Math.sin(vPhase + 1.25)) * 0.45 * cadenceAmp;
        exprTargetRef.current.ih = Math.max(0, Math.sin(vPhase + 2.60)) * 0.35 * cadenceAmp;
        exprTargetRef.current.ee = Math.max(0, Math.sin(vPhase + 3.90)) * 0.30 * cadenceAmp;
        exprTargetRef.current.ou = Math.max(0, Math.sin(vPhase + 5.15)) * 0.35 * cadenceAmp;
      }
    }

    // ── 3. Mood Expressions ───────────────────────────────────────────────────
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

    // ── 4. Smooth Expression Lerp & 3D Jaw Articulation ────────────────────────
    const MOUTH_KEYS = ["aa", "ih", "ou", "ee", "oh"] as const;
    type MouthKey = typeof MOUTH_KEYS[number];
    const mouthKeySet = new Set<string>(MOUTH_KEYS);

    // Mouth lerp: snappy open during speech, smooth glide closed when speech ends
    const mouthLerpFactor = Math.min(1, (state === "speaking" ? 24 : 14) * delta);
    for (const key of MOUTH_KEYS) {
      const target  = exprTargetRef.current[key];
      const current = exprCurrentRef.current[key];
      const next    = THREE.MathUtils.lerp(current, target, mouthLerpFactor);
      exprCurrentRef.current[key] = next;
      setExpression(vrm, key, next);
    }

    // 3D Jaw Bone opening
    const jaw = vrm.humanoid?.getNormalizedBoneNode("jaw" as VRMHumanBoneName);
    if (jaw) {
      const openAmount = Math.max(
        exprCurrentRef.current.aa,
        exprCurrentRef.current.oh * 0.85,
        exprCurrentRef.current.ou * 0.60,
        exprCurrentRef.current.ee * 0.35
      );
      const targetJawX = state === "speaking" ? openAmount * 0.11 : 0;
      jaw.rotation.x = THREE.MathUtils.lerp(jaw.rotation.x, targetJawX, Math.min(1, 22 * delta));
    }

    // Non-mouth expressions (happy, angry, sad, etc.)
    const nonMouthKeys = EXPR_KEYS.filter((k) => !mouthKeySet.has(k));
    const exprLerpFactor = Math.min(1, 8 * delta);
    for (const key of nonMouthKeys) {
      const target  = exprTargetRef.current[key];
      const current = exprCurrentRef.current[key];
      const next    = THREE.MathUtils.lerp(current, target, exprLerpFactor);
      exprCurrentRef.current[key] = next;
      setExpression(vrm, key, next);
    }

    // ── 5. Organic Multi-Frequency Life & Body Dynamics ────────────────────────
    const head      = vrm.humanoid?.getNormalizedBoneNode("head" as VRMHumanBoneName);
    const neck      = vrm.humanoid?.getNormalizedBoneNode("neck" as VRMHumanBoneName);
    const spine     = vrm.humanoid?.getNormalizedBoneNode("spine" as VRMHumanBoneName);
    const chest     = vrm.humanoid?.getNormalizedBoneNode("chest" as VRMHumanBoneName);
    const lShoulder = vrm.humanoid?.getNormalizedBoneNode("leftShoulder" as VRMHumanBoneName);
    const rShoulder = vrm.humanoid?.getNormalizedBoneNode("rightShoulder" as VRMHumanBoneName);

    // Natural breathing cycle (~4.2s inhale/exhale) + posture weight shift (~9s cycle)
    const breathCycle = Math.sin(t * 1.5);
    const postureSwayZ = Math.sin(t * 0.22) * 0.012 + Math.cos(t * 0.13) * 0.007; // lateral weight transfer
    const postureSwayY = Math.cos(t * 0.17) * 0.010; // subtle torso axial rotation

    if (spine) {
      spine.rotation.x += breathCycle * 0.008;
      spine.rotation.y += postureSwayY * 0.5;
      spine.rotation.z += postureSwayZ * 0.6;
    }
    if (chest) {
      chest.rotation.x += breathCycle * 0.012;
      chest.rotation.y += postureSwayY * 0.5;
      chest.rotation.z += postureSwayZ * 0.4;
    }
    if (lShoulder) {
      lShoulder.rotation.z += breathCycle * 0.006;
    }
    if (rShoulder) {
      rShoulder.rotation.z -= breathCycle * 0.006;
    }

    if (head) {
      const { x, y, z } = head.rotation;
      let offsetX = 0;
      let offsetY = 0;
      let offsetZ = 0;

      if (state === "speaking") {
        // Conversational speech nodding & head emphasis
        const speechNod = Math.sin(t * 3.8) * 0.014 + Math.cos(t * 2.2) * 0.008;
        offsetX = speechNod + Math.sin(t * 0.44 + 0.8) * 0.006;
        offsetY = Math.sin(t * 1.6) * 0.014 + Math.cos(t * 0.7) * 0.006;
        offsetZ = Math.sin(t * 0.9) * 0.008;
      } else if (state === "thinking") {
        if (gender === "M") {
          // Masculine executive contemplative angle (level head, steady gaze)
          offsetY = Math.sin(t * 0.18) * 0.012;
          offsetX = 0.012 + Math.sin(t * 0.14) * 0.006;
          offsetZ = 0;
        } else {
          // Reflective angle for female avatar
          offsetY = Math.sin(t * 0.22) * 0.022 + Math.cos(t * 0.63) * 0.008;
          offsetX = -0.018 - Math.sin(t * 0.16) * 0.008;
          offsetZ = 0.012 + Math.sin(t * 0.13) * 0.006;
        }
      } else if (state === "listening") {
        // Attentive listening tilt and subtle rhythmic micro-nod
        const listenNod = Math.pow(Math.max(0, Math.sin(t * 1.6)), 2) * 0.016;
        offsetX = listenNod + Math.sin(t * 0.25) * 0.006;
        offsetY = Math.sin(t * 0.35) * 0.010;
        offsetZ = 0.015 + Math.cos(t * 0.28) * 0.006;
      } else {
        // Idle organic wander
        offsetY = Math.sin(t * 0.31) * 0.015 + Math.cos(t * 0.71) * 0.007;
        offsetX = Math.sin(t * 0.21 + 1.1) * 0.007 + Math.cos(t * 0.47) * 0.004;
        offsetZ = Math.sin(t * 0.15 + 0.5) * 0.006;
      }
      head.rotation.set(x + offsetX, y + offsetY, z + offsetZ);
    }

    if (neck) {
      if (state === "listening") {
        neck.rotation.x += Math.pow(Math.max(0, Math.sin(t * 1.6)), 3) * 0.014;
        neck.rotation.z += 0.012 + Math.sin(t * 0.38) * 0.006;
      } else if (state === "speaking") {
        neck.rotation.x += Math.sin(t * 3.8) * 0.006;
      }
    }

    // Dynamically modulate gesture intensity during speaking so each cycle has a different amplitude
    const currentAction = currentActionRef.current;
    if (state === "speaking" && currentAction) {
      const dynamicWeight = 0.72 + Math.sin(t * 0.55) * 0.26;
      currentAction.setEffectiveWeight(dynamicWeight);
    }

    // Final single VRM update per frame
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
