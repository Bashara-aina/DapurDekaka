import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Facebook, Instagram, Twitter, MapPin, Phone, Mail } from "lucide-react";

export default function Contact() {
  return (
    <div className="container mx-auto px-4 py-20">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl font-bold text-gray-900 mb-6">Contact Us</h1>
          <p className="text-lg text-gray-600">
            Get in touch with us for any inquiries about our premium halal dim sum.
            We'd love to hear from you!
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card>
              <CardContent className="p-6">
                <h2 className="text-2xl font-semibold mb-6">Contact Information</h2>
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <MapPin className="h-6 w-6 text-primary" />
                    <div>
                      <h3 className="font-semibold">Address</h3>
                      <p className="text-gray-600">123 Dim Sum Street, Jakarta, Indonesia</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Phone className="h-6 w-6 text-primary" />
                    <div>
                      <h3 className="font-semibold">Phone</h3>
                      <p className="text-gray-600">+62 XXX-XXXX-XXXX</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Mail className="h-6 w-6 text-primary" />
                    <div>
                      <h3 className="font-semibold">Email</h3>
                      <p className="text-gray-600">info@dapurdekaka.com</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <h3 className="font-semibold mb-4">Follow Us</h3>
                  <div className="flex gap-4">
                    <Button variant="outline" size="icon" asChild>
                      <a href="#" className="hover:text-primary">
                        <Facebook className="h-5 w-5" />
                      </a>
                    </Button>
                    <Button variant="outline" size="icon" asChild>
                      <a href="#" className="hover:text-primary">
                        <Instagram className="h-5 w-5" />
                      </a>
                    </Button>
                    <Button variant="outline" size="icon" asChild>
                      <a href="#" className="hover:text-primary">
                        <Twitter className="h-5 w-5" />
                      </a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Card>
              <CardContent className="p-6">
                <h2 className="text-2xl font-semibold mb-6">Opening Hours</h2>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Monday - Friday</span>
                    <span>10:00 AM - 9:00 PM</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Saturday - Sunday</span>
                    <span>9:00 AM - 10:00 PM</span>
                  </div>
                </div>

                <div className="mt-8">
                  <h3 className="font-semibold mb-4">Quick Order</h3>
                  <Button className="w-full" size="lg" asChild>
                    <a
                      href="https://wa.me/your-number"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Order via WhatsApp
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
