import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, MapPin, Phone, Mail, Instagram, ShoppingBag } from "lucide-react";
import AdminNavbar from "@/components/layout/admin-navbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";

interface SocialLink {
  id: string;
  platform: string;
  url: string;
  icon: string;
}

interface FooterContent {
  companyName: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  socialLinks: SocialLink[];
  copyright: string;
  logoUrl?: string;
}

export default function FooterEditor() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("general");
  
  const [formData, setFormData] = useState<FooterContent>({
    companyName: "Dapur Dekaka",
    tagline: "Premium halal dim sum made with love and quality ingredients.",
    address: "Jl. Sinom V No.7, Turangga, Kec. Lengkong, Kota Bandung, Jawa Barat 40264",
    phone: "082295986407",
    email: "contact@dapurdekaka.com",
    socialLinks: [
      {
        id: "1",
        platform: "Instagram",
        url: "https://instagram.com/dapurdekaka",
        icon: "Instagram"
      },
      {
        id: "2",
        platform: "Shopee",
        url: "https://shopee.co.id/dapurdekaka",
        icon: "Shopee"
      }
    ],
    copyright: `© ${new Date().getFullYear()} Dapur Dekaka. All rights reserved.`,
    logoUrl: ""
  });

  const { data, isLoading } = useQuery<{ content: FooterContent }>({
    queryKey: ["/api/pages/footer"],
  });

  useEffect(() => {
    if (data?.content) {
      setFormData(data.content);
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: async (formData: FooterContent) => {
      const response = await fetch("/api/pages/footer", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
        credentials: "include"
      });
      if (!response.ok) throw new Error("Failed to update footer");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pages/footer"] });
      toast({ title: "Success", description: "Footer updated successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSocialLinkChange = (index: number, field: keyof SocialLink, value: string) => {
    setFormData(prev => {
      const updatedLinks = [...prev.socialLinks];
      updatedLinks[index] = {
        ...updatedLinks[index],
        [field]: value
      };
      return {
        ...prev,
        socialLinks: updatedLinks
      };
    });
  };

  const addSocialLink = () => {
    setFormData(prev => ({
      ...prev,
      socialLinks: [
        ...prev.socialLinks,
        {
          id: Date.now().toString(),
          platform: "",
          url: "",
          icon: "Instagram"
        }
      ]
    }));
  };

  const removeSocialLink = (index: number) => {
    setFormData(prev => ({
      ...prev,
      socialLinks: prev.socialLinks.filter((_, i) => i !== index)
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <AdminNavbar />
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Edit Footer</h1>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">General Information</TabsTrigger>
            <TabsTrigger value="social">Social & Contact</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>General Information</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      name="companyName"
                      value={formData.companyName}
                      onChange={handleInputChange}
                      placeholder="Enter company name"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="tagline">Tagline</Label>
                    <Textarea
                      id="tagline"
                      name="tagline"
                      value={formData.tagline}
                      onChange={handleInputChange}
                      placeholder="Enter company tagline or description"
                      rows={3}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="copyright">Copyright Text</Label>
                    <Input
                      id="copyright"
                      name="copyright"
                      value={formData.copyright}
                      onChange={handleInputChange}
                      placeholder="Enter copyright text"
                    />
                  </div>
                  
                  <Button type="button" onClick={handleSubmit} disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="social" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                      id="address"
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      placeholder="Enter company address"
                      rows={3}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="Enter phone number"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="Enter email address"
                      type="email"
                    />
                  </div>
                  
                  <Button type="button" onClick={handleSubmit} disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Social Media Links</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {formData.socialLinks.map((link, index) => (
                    <div key={link.id} className="flex items-start gap-4 p-4 border rounded-lg">
                      <div className="flex-1 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Platform</Label>
                            <Input
                              value={link.platform}
                              onChange={(e) => handleSocialLinkChange(index, 'platform', e.target.value)}
                              placeholder="Instagram, Facebook, etc."
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Icon</Label>
                            <select 
                              className="w-full px-3 py-2 border rounded-md"
                              value={link.icon}
                              onChange={(e) => handleSocialLinkChange(index, 'icon', e.target.value)}
                            >
                              <option value="Instagram">Instagram</option>
                              <option value="Shopee">Shopee</option>
                            </select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>URL</Label>
                          <Input
                            value={link.url}
                            onChange={(e) => handleSocialLinkChange(index, 'url', e.target.value)}
                            placeholder="https://..."
                          />
                        </div>
                      </div>
                      <Button 
                        type="button" 
                        variant="destructive" 
                        size="icon"
                        onClick={() => removeSocialLink(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  
                  <Button type="button" variant="outline" onClick={addSocialLink} className="w-full">
                    <Plus className="mr-2 h-4 w-4" /> Add Social Link
                  </Button>
                  
                  <Button type="button" onClick={handleSubmit} disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="preview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Footer Preview</CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-hidden rounded-b-lg">
                <div className="border-t">
                  {/* Local Footer Preview Component */}
                  <footer className="bg-gray-50 border-t">
                    <div className="container mx-auto px-4 py-12">
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="space-y-2">
                          <h3 className="text-xl font-bold text-primary">
                            {formData.companyName}
                          </h3>
                          <p className="text-gray-600">
                            {formData.tagline}
                          </p>
                        </div>

                        <div className="mt-2 space-y-2">
                          <div className="flex items-center justify-center gap-2 text-gray-600">
                            <MapPin className="h-5 w-5 flex-shrink-0" />
                            <span>{formData.address}</span>
                          </div>
                          <div className="flex items-center justify-center gap-2 text-gray-600">
                            <Phone className="h-5 w-5 flex-shrink-0" />
                            <span>{formData.phone}</span>
                          </div>
                          {formData.email && (
                            <div className="flex items-center justify-center gap-2 text-gray-600">
                              <Mail className="h-5 w-5 flex-shrink-0" />
                              <span>{formData.email}</span>
                            </div>
                          )}
                        </div>

                        {formData.socialLinks && formData.socialLinks.length > 0 && (
                          <div className="mt-6 flex justify-center space-x-4">
                            {formData.socialLinks.map((social) => (
                              <a
                                key={social.id}
                                href={social.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-600 hover:text-primary transition-colors"
                              >
                                {social.icon === "Instagram" ? (
                                  <Instagram className="h-5 w-5" />
                                ) : social.icon === "Shopee" ? (
                                  <ShoppingBag className="h-5 w-5" />
                                ) : (
                                  <Instagram className="h-5 w-5" />
                                )}
                              </a>
                            ))}
                          </div>
                        )}

                        <div className="mt-8 text-gray-600">
                          <p>{formData.copyright}</p>
                        </div>
                      </div>
                    </div>
                  </footer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}