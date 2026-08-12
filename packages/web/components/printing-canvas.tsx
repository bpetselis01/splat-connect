'use client'
/**
 * The one 3D moment on the site: a slowly turning printed switch mount.
 *
 * Literal rather than decorative — it is the object this service will actually
 * print, which is the only reason a WebGL dependency is justified on a marketing
 * page.
 *
 * The poster underneath is not a loading state, it is the real fallback. It
 * renders first, always, and stays for good when any of these hold:
 * - prefers-reduced-motion: reduce
 * - WebGL unavailable or context creation throws
 * - the dynamic import of three fails
 *
 * three is ~150kb, so it is imported inside the effect: no other route pays for
 * it, and this one paints before it arrives.
 *
 * Deliberately hand-rolled rather than react-three-fiber: one static scene with
 * one animated value does not need a reconciler.
 */
import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { Printer } from '@/components/icons'

export function PrintingCanvas() {
  const mount = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const [live, setLive] = useState(false)

  useEffect(() => {
    if (reduced) return
    const el = mount.current
    if (!el) return

    let dispose: (() => void) | undefined
    let cancelled = false

    void (async () => {
      let THREE: typeof import('three')
      try {
        THREE = await import('three')
      } catch {
        return // Poster stays. Nothing to tell the visitor here.
      }
      if (cancelled) return

      let renderer: import('three').WebGLRenderer
      try {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
      } catch {
        return // No WebGL. Poster stays.
      }

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
      camera.position.set(0, 2.4, 6.2)
      camera.lookAt(0, 0, 0)

      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      el.appendChild(renderer.domElement)
      renderer.domElement.style.width = '100%'
      renderer.domElement.style.height = '100%'
      renderer.domElement.style.display = 'block'

      // Flat shading so the facets read as a printed part rather than a
      // rendered product shot.
      const material = new THREE.MeshStandardMaterial({
        color: 0x1998d5,
        flatShading: true,
        roughness: 0.55,
        metalness: 0.05,
      })
      const accent = new THREE.MeshStandardMaterial({
        color: 0xff8f5e,
        flatShading: true,
        roughness: 0.5,
      })

      // A mounting plate, the collar that grips the toy's housing, and the
      // switch post standing proud of it.
      const plate = new THREE.BoxGeometry(3, 0.35, 2)
      const collar = new THREE.TorusGeometry(0.85, 0.22, 6, 18)
      const post = new THREE.CylinderGeometry(0.42, 0.5, 0.7, 12)

      const group = new THREE.Group()
      const plateMesh = new THREE.Mesh(plate, material)
      const collarMesh = new THREE.Mesh(collar, material)
      collarMesh.rotation.x = Math.PI / 2
      collarMesh.position.y = 0.3
      const postMesh = new THREE.Mesh(post, accent)
      postMesh.position.y = 0.72
      group.add(plateMesh, collarMesh, postMesh)
      group.rotation.x = 0.18
      scene.add(group)

      scene.add(new THREE.AmbientLight(0xffffff, 1.5))
      const key = new THREE.DirectionalLight(0xffffff, 2.2)
      key.position.set(3, 5, 4)
      scene.add(key)
      const rim = new THREE.DirectionalLight(0xbfe4f5, 1.1)
      rim.position.set(-4, 1, -3)
      scene.add(rim)

      const resize = () => {
        const { clientWidth: w, clientHeight: h } = el
        if (!w || !h) return
        renderer.setSize(w, h, false)
        camera.aspect = w / h
        camera.updateProjectionMatrix()
      }
      resize()
      const observer = new ResizeObserver(resize)
      observer.observe(el)

      // Pauses off-screen and on a hidden tab: a marketing page should not hold
      // a GPU loop open behind whatever the visitor moved on to.
      let visible = true
      const io = new IntersectionObserver(([e]) => {
        visible = e.isIntersecting
      })
      io.observe(el)

      let frame = 0
      const tick = () => {
        frame = requestAnimationFrame(tick)
        if (!visible || document.hidden) return
        group.rotation.y += 0.004
        renderer.render(scene, camera)
      }
      tick()
      setLive(true)

      dispose = () => {
        cancelAnimationFrame(frame)
        observer.disconnect()
        io.disconnect()
        renderer.domElement.remove()
        renderer.dispose()
        ;[plate, collar, post].forEach((g) => g.dispose())
        ;[material, accent].forEach((m) => m.dispose())
      }
    })()

    return () => {
      cancelled = true
      dispose?.()
    }
  }, [reduced])

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-brand-tint">
      {/* The poster. Hidden only once a frame has actually been drawn. */}
      <div
        aria-hidden="true"
        className={`absolute inset-0 grid place-items-center text-7xl text-brand-dark transition-opacity duration-500 ${
          live ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <Printer />
      </div>
      <div ref={mount} className="absolute inset-0" />
    </div>
  )
}
