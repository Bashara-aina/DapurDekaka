import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ContactForm } from "@/components/contact-form";

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white to-gray-50">
      <div className="container mx-auto px-4 py-20 md:py-32">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge className="mb-4">100% Halal Certified</Badge>
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              Dapur Dekaka – Nikmati Sensasi Dimsum Premium dengan Cita Rasa Autentik!
            </h1>
            <p className="text-lg text-gray-600 mb-8">
              Experience our handcrafted dim sum made with premium ingredients and authentic recipes.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button size="lg" asChild>
                <a href="/menu">Lihat Menu</a>
              </Button>
              <ContactForm>
                <Button size="lg" variant="outline">
                  Contact Us
                </Button>
              </ContactForm>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="relative"
          >
            <img
              src="https://images.unsplash.com/photo-1496116218417-1a781b1c416c"
              alt="Premium Dim Sum"
              className="rounded-lg shadow-xl"
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent rounded-lg" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}