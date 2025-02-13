import Image from "next/image";

export function Footer() {
  return (
    <footer className="w-full bg-white py-12 border-t">
      <div className="container mx-auto flex flex-col items-center justify-center space-y-6 px-4">
        <div className="w-32 h-auto relative">
          <Image
            src="/logo.png"
            alt="Dapur Dekaka Logo"
            width={128}
            height={128}
            className="object-contain"
          />
        </div>
        
        <p className="text-gray-700 text-center max-w-md">
          Premium halal dim sum made with love and quality ingredients.
        </p>

        <div className="text-gray-600 text-center space-y-2">
          <p>
            Jl. Sinom V No.7, Turangga, Kec. Lengkong, 
            <br />
            Kota Bandung, Jawa Barat 40264
          </p>
          <p className="font-medium">082295986407</p>
        </div>
      </div>
    </footer>
  );
}
