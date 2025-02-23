
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MarketplaceDialog } from "./MarketplaceDialog";

export function ProductCard({ product }) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-full h-48 object-cover rounded-lg mb-4"
        />
        <h3 className="font-semibold mb-2">{product.name}</h3>
        <p className="text-sm text-gray-600 mb-4">{product.description}</p>
        <Button 
          className="w-full" 
          onClick={() => setDialogOpen(true)}
        >
          Pesan
        </Button>
      </CardContent>
      <MarketplaceDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </Card>
  );
}
