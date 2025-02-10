import { Facebook, Instagram, Twitter } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-gray-50 border-t">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-xl font-bold text-primary mb-4">Dapur Dekaka</h3>
            <p className="text-gray-600">
              Premium halal dim sum made with love and quality ingredients.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li><a href="/menu" className="text-gray-600 hover:text-primary">Menu</a></li>
              <li><a href="/about" className="text-gray-600 hover:text-primary">About Us</a></li>
              <li><a href="#locations" className="text-gray-600 hover:text-primary">Locations</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Contact</h4>
            <ul className="space-y-2 text-gray-600">
              <li>Email: info@dapurdekaka.com</li>
              <li>Phone: +62 XXX-XXXX-XXXX</li>
              <li>WhatsApp: +62 XXX-XXXX-XXXX</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Follow Us</h4>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-600 hover:text-primary">
                <Facebook className="h-6 w-6" />
              </a>
              <a href="#" className="text-gray-600 hover:text-primary">
                <Instagram className="h-6 w-6" />
              </a>
              <a href="#" className="text-gray-600 hover:text-primary">
                <Twitter className="h-6 w-6" />
              </a>
            </div>
          </div>
        </div>
        
        <div className="mt-12 pt-8 border-t text-center text-gray-600">
          <p>&copy; {new Date().getFullYear()} Dapur Dekaka. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
