import { motion } from "framer-motion";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { menuData } from "@shared/menu-data";

export default function Menu() {
  return (
    <div className="container mx-auto px-4 py-20">
      <div className="max-w-2xl mx-auto text-center mb-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Our Menu</h1>
        <p className="text-lg text-gray-600">
          Discover our selection of premium halal dim sum, handcrafted with care and quality ingredients
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {menuData.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
          >
            <Card className="h-full">
              <CardContent className="p-0">
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="w-full h-48 object-cover"
                />
              </CardContent>
              <CardFooter className="flex flex-col items-start gap-3 p-6">
                <h3 className="font-semibold text-xl">{item.name}</h3>
                <p className="text-gray-600">{item.description}</p>
                <div className="flex justify-between items-center w-full mt-4">
                  <span className="font-bold text-primary">
                    Rp {item.price.toLocaleString()}
                  </span>
                  <Button asChild>
                    <a
                      href={`https://wa.me/your-number?text=I would like to order ${item.name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Pesan Sekarang
                    </a>
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
