
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Icon } from "@iconify/react";
import { Instagram } from "lucide-react";

interface MarketplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MarketplaceModal({ isOpen, onClose }: MarketplaceModalProps) {
  const marketplaces = [
    {
      name: "Shopee",
      url: "https://shopee.co.id/dapurdekaka",
      icon: "simple-icons:shopee",
      className: "text-orange-500"
    },
    {
      name: "Instagram",
      url: "https://instagram.com/dapurdekaka",
      icon: Instagram,
      className: "text-pink-500"
    },
    {
      name: "Grab",
      url: "https://mart.grab.com/id/id/merchant/6-C62BTTXXSB33TE",
      icon: "simple-icons:grab",
      className: "text-green-500"
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <div className="grid gap-4">
          <h2 className="text-xl font-semibold text-center">Pilih Marketplace</h2>
          <div className="grid gap-2">
            {marketplaces.map((marketplace) => (
              <Button
                key={marketplace.name}
                variant="outline"
                className="w-full h-16 gap-4"
                asChild
              >
                <a
                  href={marketplace.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center"
                >
                  {typeof marketplace.icon === 'string' ? (
                    <Icon
                      icon={marketplace.icon}
                      className={`h-8 w-8 ${marketplace.className}`}
                    />
                  ) : (
                    <marketplace.icon
                      className={`h-8 w-8 ${marketplace.className}`}
                    />
                  )}
                  <span className="text-lg">{marketplace.name}</span>
                </a>
              </Button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
