import { MapPin, Phone } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-gray-50 border-t">
      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-primary">Dapur Dekaka</h3>
            <p className="text-gray-600">
              Premium halal dim sum made with love and quality ingredients.
            </p>
          </div>

          <div className="mt-2 space-y-2">
            <div className="flex items-center justify-center gap-2 text-gray-600">
              <MapPin className="h-5 w-5 flex-shrink-0" />
              <span>
                Jl. Sinom V No.7, Turangga, Kec. Lengkong, Kota Bandung, Jawa
                Barat 40264
              </span>
            </div>
            <div className="flex items-center justify-center gap-2 text-gray-600">
              <Phone className="h-5 w-5 flex-shrink-0" />
              <span>082295986407</span>
            </div>
          </div>

          <div className="mt-8 text-gray-600">
            <p>
              &copy; {new Date().getFullYear()} Dapur Dekaka. All rights
              reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
