import AnimatedBackground from "@/components/AnimatedBackground";
import Navbar from "@/components/Navbar";
import Hero from "@/components/sections/Hero";
import About from "@/components/sections/About";
import AIEngineering from "@/components/sections/AIEngineering";
import Projects from "@/components/sections/Projects";
import Experience from "@/components/sections/Experience";
import Skills from "@/components/sections/Skills";
import Education from "@/components/sections/Education";
import Contact from "@/components/sections/Contact";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-x-hidden">
      <AnimatedBackground />
      <div className="relative z-10">
        <Navbar />
        <Hero />
        <About />
        <AIEngineering />
        <Projects />
        <Experience />
        <Skills />
        <Education />
        <Contact />
        <Footer />
      </div>
    </main>
  );
}
