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

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-20"
        >
          <div className="prose prose-xl max-w-none">
            <h2 className="text-4xl font-bold text-gray-900 mb-8 text-center">
              Kenapa Pilih Dapur Dekaka?
            </h2>
            <p className="text-xl text-gray-600 text-center mb-12">
              Di Dapur Dekaka, kami sangat bersemangat untuk menghadirkan cita rasa otentik dim sum buatan
              tangan ke meja Anda. Berbasis di Bandung, kami bangga memberikan produk berkualitas tinggi
              yang menonjol karena rasa dan integritasnya. Inilah alasan mengapa Anda harus memilih kami:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="p-6 bg-white rounded-lg shadow-lg">
                <h3 className="text-2xl font-semibold mb-4">Bahan-bahan Premium</h3>
                <p className="text-gray-600">
                  Kami hanya menggunakan bahan-bahan terbaik untuk memastikan rasa
                  dan kualitas yang luar biasa.
                </p>
              </div>

              <div className="p-6 bg-white rounded-lg shadow-lg">
                <h3 className="text-2xl font-semibold mb-4">Keunggulan Buatan Tangan</h3>
                <p className="text-gray-600">
                  Setiap potongan dim sum dibuat dengan hati-hati, mempertahankan
                  sentuhan tradisional.
                </p>
              </div>

              <div className="p-6 bg-white rounded-lg shadow-lg">
                <h3 className="text-2xl font-semibold mb-4">Bersertifikat Halal</h3>
                <p className="text-gray-600">
                  Nikmati produk kami dengan tenang, karena telah memenuhi standar halal
                  tertinggi.
                </p>
              </div>

              <div className="p-6 bg-white rounded-lg shadow-lg">
                <h3 className="text-2xl font-semibold mb-4">Tanpa Pengawet</h3>
                <p className="text-gray-600">
                  Kesegaran dan rasa alami adalah prioritas kami, tanpa bahan pengawet.
                </p>
              </div>
            </div>

            <p className="text-2xl text-gray-800 text-center mt-12 font-semibold">
              Rasakan perbedaannya dengan dim sum kami yang autentik, beraroma, dan sehat hari ini!
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}