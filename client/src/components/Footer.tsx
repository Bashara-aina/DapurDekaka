import Image from "next/image";

export function Footer() {
  return (
    <footer className="w-full bg-gray-50 py-16">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center text-center space-y-12">
          {/* Brand Section */}
          <div className="space-y-4">
            <h2 className="text-red-700 text-3xl font-bold">Dapur Dekaka</h2>
            <p className="text-gray-600">
              Premium halal dim sum made with love and quality ingredients.
            </p>
          </div>

          {/* Quick Links Section */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Quick Links</h3>
            <nav className="flex flex-col space-y-2">
              <a href="#" className="text-gray-600 hover:text-red-700">Menu</a>
              <a href="#" className="text-gray-600 hover:text-red-700">About Us</a>
              <a href="#" className="text-gray-600 hover:text-red-700">Locations</a>
            </nav>
          </div>

          {/* Contact Section */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Contact</h3>
            <div className="flex flex-col space-y-2 text-gray-600">
              <p>Email: info@dapurdekaka.com</p>
              <p>Phone: +62 XXX-XXXX-XXXX</p>
              <p>WhatsApp: +62 XXX-XXXX-XXXX</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}