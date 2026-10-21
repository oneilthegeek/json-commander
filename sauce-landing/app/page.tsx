import Providers from "@/components/Providers";
import Nav from "@/components/Nav";
import Cursor from "@/components/Cursor";
import Grain from "@/components/Grain";
import Loader from "@/components/Loader";
import Marquee from "@/components/Marquee";
import ScrollDirector from "@/components/ScrollDirector";
import Hero from "@/components/sections/Hero";
import Story from "@/components/sections/Story";
import Shop from "@/components/sections/Shop";
import Flavors from "@/components/sections/Flavors";
import Ingredients from "@/components/sections/Ingredients";
import Cta from "@/components/sections/Cta";
import Footer from "@/components/sections/Footer";
import SceneCanvas from "@/components/three/SceneCanvas";

export default function Page() {
  return (
    <Providers>
      <Loader />
      <Cursor />
      <Grain />
      <Nav />
      {/* fixed WebGL stage: sits between background type (z-0) and content (z-20) */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-10">
        <SceneCanvas />
      </div>
      <ScrollDirector />
      <main>
        <Hero />
        <Marquee />
        <Story />
        <Shop />
        <Flavors />
        <Marquee tilt={2} inverted />
        <Ingredients />
        <Cta />
      </main>
      <Footer />
    </Providers>
  );
}
