import { motion } from "framer-motion";

export default function About() {
  return (
    <div className="container mx-auto px-4 py-20">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h1 className="text-6xl font-bold text-gray-900 mb-6">
            About Dapur Dekaka
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-12 items-stretch"
        >
          <div className="h-full">
            <img
              src="asset/28.jpg"
              alt="Our Kitchen"
              className="w-full h-full object-cover rounded-lg shadow-lg"
            />
          </div>
          <div className="flex flex-col justify-center">
            <div className="prose prose-xl">
              <p className="text-2xl text-gray-600 leading-relaxed">
                Dapur Dekaka adalah usaha yang bergerak di bidang makanan beku
                khususnya dimsum. Berawal dari usaha peninggalan keluarga,
                menjadikan produk kami dibuat sepenuh hati dari keluarga kami untuk
                anda.
              </p>
              <p className="text-2xl text-gray-600 leading-relaxed mt-6">
                Berasal dari Bandung, usaha kami telah membantu pelaku bisnis
                (restoran, cafe, online shop, distributor) dalam meningkatkan
                keuntungan mereka dengan menjual produk kami yang terjangkau dan
                berkualitas.
              </p>
              <p className="text-2xl text-gray-600 leading-relaxed mt-6">
                Sertifikasi Halal MUI yang diberikan pada produk kami memberikan
                kepercayaan lebih kepada konsumen akan kualitas bahan baku dan
                proses Dapur Dekaka.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}