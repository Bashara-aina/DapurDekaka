
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface OrderModalProps {
  children: React.ReactNode;
}

export function OrderModal({ children }: OrderModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="grid grid-cols-3 gap-4 py-4"
        >
          <Button variant="outline" size="lg" className="h-24" asChild>
            <a
              href="https://shopee.co.id/dapurdekaka"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-2"
            >
              <Icon icon="simple-icons:shopee" className="h-8 w-8" />
              <span className="text-sm">Shopee</span>
            </a>
          </Button>
          <Button variant="outline" size="lg" className="h-24" asChild>
            <a
              href="https://instagram.com/dapurdekaka"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-2"
            >
              <Icon icon="mdi:instagram" className="h-8 w-8" />
              <span className="text-sm">Instagram</span>
            </a>
          </Button>
          <Button variant="outline" size="lg" className="h-24" asChild>
            <a
              href="https://mart.grab.com/id/id/merchant/6-C62BTTXXSB33TE"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-2"
            >
              <Icon icon="simple-icons:grab" className="h-8 w-8" />
              <span className="text-sm">Grab</span>
            </a>
          </Button>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
