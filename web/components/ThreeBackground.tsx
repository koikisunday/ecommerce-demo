import React, { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Mesh } from 'three'

function RotatingBox() {
  const ref = useRef<Mesh>(null!)
  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    ref.current.rotation.x = t * 0.3
    ref.current.rotation.y = t * 0.6
    ref.current.position.x = Math.sin(t * 0.5) * 0.5
  })
  return (
    <mesh ref={ref} position={[0, 0, 0]}>
      <boxGeometry args={[1.2, 1.2, 1.2]} />
      <meshStandardMaterial color={0x4f46e5} metalness={0.3} roughness={0.2} />
    </mesh>
  )
}

export default function ThreeBackground() {
  return (
    <div className="absolute inset-0 -z-10">
      <Canvas camera={{ position: [0, 0, 5] }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[2, 5, 5]} intensity={0.8} />
        <RotatingBox />
      </Canvas>
    </div>
  )
}
