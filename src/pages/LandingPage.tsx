import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ArrowRight, BookOpen, Users, TrendingUp, Sparkles } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="container mx-auto px-4 py-20 lg:py-32">
          <div className="max-w-4xl mx-auto text-center">
            {/* Main heading with fade-in */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6">
                <Sparkles className="w-4 h-4" />
                <span className="text-sm font-medium">Learn. Teach. Exchange.</span>
              </div>
              
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-foreground mb-6">
                Skill Swap
              </h1>
            </motion.div>

            {/* Subtitle with delayed fade-in */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
              className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto"
            >
              Exchange skills with fellow students. Teach what you know, learn what you need.
            </motion.p>

            {/* CTA buttons with delayed fade-in */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12"
            >
              <Button size="lg" className="text-lg px-8">
                Get Started
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8">
                Learn More
              </Button>
            </motion.div>

            {/* Feature cards with staggered fade-in */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6, ease: "easeOut" }}
              className="grid md:grid-cols-3 gap-6 mt-16"
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.7, ease: "easeOut" }}
                className="p-6 rounded-lg border bg-card text-card-foreground shadow-sm"
              >
                <BookOpen className="w-8 h-8 text-primary mb-4 mx-auto" />
                <h3 className="text-lg font-semibold mb-2">Learn Skills</h3>
                <p className="text-sm text-muted-foreground">
                  Discover new skills from talented peers in your community
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.8, ease: "easeOut" }}
                className="p-6 rounded-lg border bg-card text-card-foreground shadow-sm"
              >
                <Users className="w-8 h-8 text-primary mb-4 mx-auto" />
                <h3 className="text-lg font-semibold mb-2">Teach Others</h3>
                <p className="text-sm text-muted-foreground">
                  Share your expertise and help others grow their skills
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.9, ease: "easeOut" }}
                className="p-6 rounded-lg border bg-card text-card-foreground shadow-sm"
              >
                <TrendingUp className="w-8 h-8 text-primary mb-4 mx-auto" />
                <h3 className="text-lg font-semibold mb-2">Exchange</h3>
                <p className="text-sm text-muted-foreground">
                  Trade skills and build a network of mutual learning
                </p>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  )
}
