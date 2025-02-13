import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";

const features = [
  "Handmade with high-quality ingredients",
  "100% Halal-certified",
  "Fresh and hygienic preparation",
  "Affordable pricing",
  "Wide variety of flavors",
];

export default function About() {
  return (
    <div className="container mx-auto px-4 py-20">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl font-bold text-gray-900 mb-6">
            About Dapur Dekaka
          </h1>
          <p className="text-lg text-gray-600">
            Dapur Dekaka adalah usaha yang bergerak di bidang makanan beku
            khususnya dimsum. Berawal dari usaha peninggalan keluarga,
            menjadikan produk kami dibuat sepenuh hati dari keluarga kami untuk
            anda. <br /> <br />
            Berasal dari Bandung, usaha kami telah membantu pelaku bisnis
            (restoran, cafe, online shop, distributor) dalam meningkatkan
            keuntungan mereka dengan menjual produk kami yang terjangkau dan
            berkualitas. <br />
            <br />
            Sertifikasi Halal MUI yang diberikan pada produk kami memberikan
            kepercayaan lebih kepada konsumen akan kualitas bahan baku dan
            proses Dapur Dekaka.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center mb-16"
        >
          <div>
            <img
              src="asset/28.jpg"
              alt="Our Kitchen"
              className="rounded-lg shadow-lg"
            />
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-6">Why Choose Us?</h2>
            <ul className="space-y-4">
              {features.map((feature, index) => (
                <motion.li
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.3 + index * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <CheckCircle className="h-6 w-6 text-primary" />
                  <span className="text-gray-600">{feature}</span>
                </motion.li>
              ))}
            </ul>
          </div>
        </motion.div>

        <div className="bg-gray-50 rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-6">Our Story</h2>
          <p className="text-gray-600 leading-relaxed">
            Dapur Dekaka was born from a passion for authentic dim sum and a
            vision to make premium quality halal dim sum accessible to everyone.
            Our journey began in a small kitchen, where we perfected our recipes
            using only the finest halal ingredients while maintaining the
            traditional techniques that make dim sum special.
          </p>
        </div>
      </div>
    </div>
  );
}
