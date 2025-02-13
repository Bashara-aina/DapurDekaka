import { FaFacebook, FaInstagram, FaLinkedin, FaYoutube, FaWhatsapp } from 'react-icons/fa';
import { FaTiktok } from 'react-icons/fa6';
import { MapPin, Phone } from 'lucide-react';

export function Footer() {
  return (
    <footer className="w-full bg-white py-12 border-t">
      <div className="container mx-auto flex flex-col items-center justify-center space-y-6 px-4">
        <div className="w-32 h-auto">
          <img
            src="/logo.png"
            alt="Chickin Logo"
            className="w-full h-auto object-contain"
          />
        </div>

        <p className="text-gray-700 text-center max-w-2xl">
          Chickin Indonesia merupakan perusahaan agritech yang menyediakan solusi terintegrasi untuk peternak ayam broiler.
        </p>

        <div className="text-gray-600 text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <MapPin className="w-5 h-5" />
            <p>
              Jl. Pejaten Barat III No.12B, Pejaten Barat Kec. Pasar Minggu,
              <br />
              Kota Jakarta Selatan, Daerah Khusus Ibukota Jakarta 12510
            </p>
          </div>
          <div className="flex items-center justify-center gap-2">
            <Phone className="w-5 h-5" />
            <p className="font-medium">6281370000357</p>
          </div>
        </div>

        <div className="flex gap-4 mt-4">
          <FaFacebook className="w-8 h-8 text-blue-600 cursor-pointer hover:opacity-80" />
          <FaInstagram className="w-8 h-8 text-pink-600 cursor-pointer hover:opacity-80" />
          <FaTiktok className="w-8 h-8 text-black cursor-pointer hover:opacity-80" />
          <FaWhatsapp className="w-8 h-8 text-green-500 cursor-pointer hover:opacity-80" />
          <FaLinkedin className="w-8 h-8 text-blue-500 cursor-pointer hover:opacity-80" />
          <FaYoutube className="w-8 h-8 text-red-600 cursor-pointer hover:opacity-80" />
        </div>
      </div>
    </footer>
  );
}