## 2024-10-01 - WebGL Shader Off-screen Optimization
**Learning:** Continuous WebGL shaders (like GrainGradient) consume CPU/GPU cycles even when off-screen.
**Action:** Always pause high-frequency loops by setting `speed` to 0 when elements are off-screen using an intersection observer like `useInView` from `framer-motion` (or `motion/react`), attaching the ref to an always-rendered parent container.
