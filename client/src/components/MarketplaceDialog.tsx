
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Icon } from "@iconify/react";
import { Instagram } from "lucide-react";

interface MarketplaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MarketplaceDialog({ open, onOpenChange }: MarketplaceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <div className="grid gap-4">
          <h2 className="text-lg font-semibold text-center">Pilih Marketplace</h2>
          <div className="flex flex-col gap-3">
            <Button variant="outline" className="w-full" size="lg" asChild>
              <a
                href="https://shopee.co.id/dapurdekaka"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2"
              >
                <Icon icon="simple-icons:shopee" className="h-5 w-5" />
                <span>Shopee</span>
              </a>
            </Button>
            <Button variant="outline" className="w-full" size="lg" asChild>
              <a
                href="https://instagram.com/dapurdekaka"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2"
              >
                <Instagram className="h-5 w-5" />
                <span>Instagram</span>
              </a>
            </Button>
            <Button variant="outline" className="w-full" size="lg" asChild>
              <a
                href="https://mart.grab.com/id/id/merchant/6-C62BTTXXSB33TE"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2"
              >
                <Icon icon="simple-icons:grab" className="h-5 w-5" />
                <span>Grab</span>
              </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
