import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Save, Image as ImageIcon, MapPin, Phone, Mail, Clock, Link2, Upload } from "lucide-react";
import AdminNavbar from "@/components/layout/admin-navbar";
import { toast } from "@/hooks/use-toast";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Icon } from "@iconify/react";

type ContactPageContent = {
  title: string;
  description: string;
  mainImage: string;
  contactInfo: {
    address: string;
    phone: string;
    email: string;
    openingHours: string;
    mapEmbedUrl: string;
  };
  socialLinks: {
    id: string;
    label: string;
    url: string;
    icon: string;
  }[];
  quickOrderUrl: string;
};

export default function ContactPageEditor() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("general");
  const [previewData, setPreviewData] = useState<ContactPageContent | null>(null);
  const [mainImageFile, setMainImageFile] = useState<File | null>(null);
  const [mainImagePreview, setMainImagePreview] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: isAuthenticated, isLoading: authLoading } = useQuery({
    queryKey: ['/api/auth-check'],
    queryFn: async () => {
      const response = await fetch('/api/auth-check', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Unauthorized');
      }
      return true;
    },
    retry: false,
    staleTime: 0,
    gcTime: 0
  });

  const { data: pageData, isLoading: pageLoading } = useQuery({
    queryKey: ['/api/pages/contact'],
    queryFn: async () => {
      const response = await fetch('/api/pages/contact');
      if (!response.ok) {
        throw new Error('Failed to fetch contact page data');
      }
      const data = await response.json();
      return data.content;
    },
    enabled: isAuthenticated === true
  });

  const form = useForm<ContactPageContent>({
    defaultValues: {
      title: "",
      description: "",
      mainImage: "",
      contactInfo: {
        address: "",
        phone: "",
        email: "",
        openingHours: "",
        mapEmbedUrl: ""
      },
      socialLinks: [
        { id: "shopee", label: "Shopee", url: "", icon: "simple-icons:shopee" },
        { id: "instagram", label: "Instagram", url: "", icon: "lucide:instagram" },
        { id: "grab", label: "Grab", url: "", icon: "simple-icons:grab" }
      ],
      quickOrderUrl: ""
    }
  });

  // Update form with data from API
  useEffect(() => {
    if (pageData) {
      form.reset(pageData);
      setPreviewData(pageData);
    }
  }, [pageData, form]);

  // Handle main image upload
  const handleMainImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setMainImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setMainImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Form submission handler
  const handleSubmit = async (values: ContactPageContent) => {
    try {
      let updatedValues = { ...values };
      
      // Handle image uploads if needed
      if (mainImageFile) {
        const formData = new FormData();
        formData.append('mainImage', mainImageFile);
        formData.append('content', JSON.stringify(updatedValues));
        
        await fetch('/api/pages/contact/upload', {
          method: 'POST',
          credentials: 'include',
          body: formData
        });
      } else {
        // Just update the content without image uploads
        await apiRequest('/api/pages/contact', {
          method: 'PUT',
          body: { content: updatedValues }
        });
      }
      
      // Invalidate query to refresh data
      queryClient.invalidateQueries({ queryKey: ['/api/pages/contact'] });
      
      toast({
        title: "Success!",
        description: "Contact page has been updated successfully.",
      });
      
      // Reset file upload states
      setMainImageFile(null);
      
      // Update preview data
      setPreviewData(updatedValues);
    } catch (error) {
      console.error('Error updating contact page:', error);
      toast({
        title: "Error",
        description: "Failed to update contact page. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Reset the form handler
  const handleReset = () => {
    if (pageData) {
      form.reset(pageData);
      setMainImageFile(null);
      setMainImagePreview(null);
    }
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation('/auth');
    }
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <AdminNavbar />
      <div className="container py-10">
        <div className="mb-10">
          <h1 className="text-3xl font-bold">Contact Page Editor</h1>
          <p className="text-gray-500">
            Edit your contact page information, social media links, and more.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="mb-6">
            <TabsTrigger value="general">General Information</TabsTrigger>
            <TabsTrigger value="social">Social & Contact Info</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
              <TabsContent value="general" className="space-y-6">
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-6">
                      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                        <div className="space-y-4">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div>
                                <FormField
                                  control={form.control}
                                  name="title"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Page Title</FormLabel>
                                      <FormControl>
                                        <Input placeholder="Contact Us" {...field} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>The main title displayed at the top of the contact page.</p>
                            </TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div>
                                <FormField
                                  control={form.control}
                                  name="description"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>Page Description</FormLabel>
                                      <FormControl>
                                        <Textarea 
                                          placeholder="Get in touch with us for any inquiries..." 
                                          rows={4}
                                          {...field} 
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>A brief description that appears below the title.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>

                        <div className="space-y-4">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div>
                                <Label>Main Image</Label>
                                <div className="mt-2">
                                  <div className="flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-4 h-[200px] cursor-pointer overflow-hidden relative">
                                    {(mainImagePreview || form.watch("mainImage")) ? (
                                      <img 
                                        src={mainImagePreview || form.watch("mainImage")} 
                                        alt="Contact page main image"
                                        className="object-cover w-full h-full rounded"
                                      />
                                    ) : (
                                      <div className="text-center">
                                        <ImageIcon className="h-10 w-10 mx-auto text-gray-400" />
                                        <p className="mt-2 text-sm text-gray-500">
                                          Upload an image for the contact page
                                        </p>
                                      </div>
                                    )}
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={handleMainImageChange}
                                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                  </div>
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>The main image displayed on the contact page.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="social" className="space-y-6">
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-6">
                      <h3 className="text-lg font-semibold">Contact Information</h3>
                      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="contactInfo.address"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2">
                                <MapPin className="h-4 w-4" /> Address
                              </FormLabel>
                              <FormControl>
                                <Textarea rows={3} {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="contactInfo.phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2">
                                <Phone className="h-4 w-4" /> Phone Number
                              </FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="contactInfo.email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2">
                                <Mail className="h-4 w-4" /> Email
                              </FormLabel>
                              <FormControl>
                                <Input type="email" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="contactInfo.openingHours"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2">
                                <Clock className="h-4 w-4" /> Opening Hours
                              </FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="contactInfo.mapEmbedUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              Google Maps Embed URL
                            </FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                            <div className="text-sm text-gray-500 mt-1">
                              Enter the embed URL from Google Maps (iframe src attribute).
                            </div>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="quickOrderUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <Link2 className="h-4 w-4" /> Quick Order URL (WhatsApp)
                            </FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                            <div className="text-sm text-gray-500 mt-1">
                              Enter the WhatsApp URL (e.g., https://wa.me/6282295986407).
                            </div>
                          </FormItem>
                        )}
                      />

                      <h3 className="text-lg font-semibold pt-2">Social Media Links</h3>
                      
                      {form.watch("socialLinks")?.map((socialLink, index) => (
                        <div key={socialLink.id} className="grid gap-4 grid-cols-1 md:grid-cols-2">
                          <FormField
                            control={form.control}
                            name={`socialLinks.${index}.label`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  {socialLink.id.charAt(0).toUpperCase() + socialLink.id.slice(1)} Label
                                </FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`socialLinks.${index}.url`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  {socialLink.id.charAt(0).toUpperCase() + socialLink.id.slice(1)} URL
                                </FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="preview" className="space-y-6">
                <Card>
                  <CardContent className="pt-6">
                    <h3 className="text-xl font-semibold mb-4">Contact Page Preview</h3>
                    <div className="border rounded-lg p-6 bg-white dark:bg-gray-800">
                      {previewData ? (
                        <div className="space-y-6">
                          <div className="text-center mb-8">
                            <h1 className="text-3xl font-bold">{previewData.title}</h1>
                            <p className="text-gray-600 mt-2">{previewData.description}</p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="border rounded-lg p-4">
                              <h2 className="text-xl font-semibold mb-4">Contact Information</h2>
                              <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                  <MapPin className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                                  <div>
                                    <h3 className="font-medium">Address</h3>
                                    <p className="text-gray-600">{previewData.contactInfo.address}</p>
                                  </div>
                                </div>
                                <div className="flex items-start gap-3">
                                  <Phone className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                                  <div>
                                    <h3 className="font-medium">Phone</h3>
                                    <p className="text-gray-600">{previewData.contactInfo.phone}</p>
                                  </div>
                                </div>
                                <div className="flex items-start gap-3">
                                  <Mail className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                                  <div>
                                    <h3 className="font-medium">Email</h3>
                                    <p className="text-gray-600">{previewData.contactInfo.email}</p>
                                  </div>
                                </div>
                              </div>

                              <div className="mt-6">
                                <h3 className="font-medium mb-2">Follow Us</h3>
                                <div className="flex gap-3">
                                  {previewData.socialLinks.map((link) => (
                                    <div key={link.id} className="border rounded-md h-10 w-10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700">
                                      {link.icon.includes('lucide:') ? (
                                        <Mail className="h-5 w-5" />
                                      ) : (
                                        <Icon icon={link.icon} className="h-5 w-5" />
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div className="border rounded-lg p-4">
                              <h2 className="text-xl font-semibold mb-4">Opening Hours</h2>
                              <div className="flex justify-between mb-4">
                                <span className="text-gray-600">Daily</span>
                                <span>{previewData.contactInfo.openingHours}</span>
                              </div>

                              <div className="mt-6">
                                <h3 className="font-medium mb-2">Quick Order</h3>
                                <div className="bg-primary text-white py-2 px-4 rounded text-center">
                                  Order via WhatsApp
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="border rounded-lg p-4 mt-8">
                            <h2 className="text-xl font-semibold mb-4">Find Us</h2>
                            <div className="bg-gray-200 dark:bg-gray-700 aspect-video rounded-lg flex items-center justify-center">
                              <p className="text-gray-500 dark:text-gray-400">[Google Map Embed would appear here]</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-64">
                          <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <div className="flex justify-end space-x-4">
                <Button type="button" variant="outline" onClick={handleReset}>
                  Reset
                </Button>
                <Button type="submit">
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            </form>
          </Form>
        </Tabs>
      </div>
    </div>
  );
}