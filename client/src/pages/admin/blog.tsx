
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BlogPost } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Pencil, Trash2, Plus, Image as ImageIcon } from "lucide-react";

export default function AdminBlogPage() {
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/blog');
        setIsAuthenticated(response.status === 200);
      } catch (error) {
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const title = formData.get('title')?.toString().trim();
    const content = formData.get('content')?.toString().trim();

    if (!title || !content) {
      toast({
        title: "Error",
        description: "Title and content are required",
        variant: "destructive",
      });
      return;
    }

    formData.set('title', title);
    formData.set('content', content);
    formData.set('published', formData.get('published') ? '1' : '0');

    try {
      if (editingPost) {
        await updateMutation.mutateAsync({ id: editingPost.id, formData });
      } else {
        await createMutation.mutateAsync(formData);
      }
      form.reset();
      setEditingPost(null);
      setImagePreview(null);
      setIsEditing(false);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/blog", {
        method: "POST",
        body: formData,
        credentials: 'include'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create post");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blog"] });
      toast({ title: "Success", description: "Blog post created successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, formData }: { id: number; formData: FormData }) => {
      const response = await fetch(`/api/blog/${id}`, {
        method: "PUT",
        body: formData,
        credentials: 'include'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update post");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blog"] });
      toast({ title: "Success", description: "Blog post updated successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/blog/${id}`, {
        method: "DELETE",
        credentials: 'include'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete post");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blog"] });
      toast({ title: "Success", description: "Blog post deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Query for fetching posts
  const { data: posts, isLoading } = useQuery<BlogPost[]>({
    queryKey: ["/api/blog"],
    queryFn: async () => {
      const response = await fetch("/api/blog");
      if (!response.ok) throw new Error("Failed to fetch posts");
      return response.json();
    },
  });

  if (isLoading) return <div>Loading...</div>;

  if (isEditing) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">{editingPost ? "Edit Blog Post" : "Create Blog Post"}</h1>
          <Button onClick={() => {
            setIsEditing(false);
            setEditingPost(null);
            setImagePreview(null);
          }}>
            Back to Posts
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Title *</label>
            <Input
              name="title"
              defaultValue={editingPost?.title}
              required
              minLength={3}
              placeholder="Enter blog post title"
              className="text-xl"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Image</label>
            <Input
              type="file"
              name="image"
              accept="image/*"
              onChange={handleImageChange}
            />
            {(imagePreview ?? editingPost?.imageUrl) && (
              <div className="mt-4">
                <img
                  src={imagePreview ?? editingPost?.imageUrl}
                  alt="Preview"
                  className="max-h-[400px] w-full object-cover rounded-lg"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Content *</label>
            <Textarea
              name="content"
              defaultValue={editingPost?.content}
              required
              minLength={10}
              placeholder="Enter blog post content"
              className="min-h-[400px] text-lg"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Input
              type="checkbox"
              name="published"
              defaultChecked={editingPost?.published === 1}
              className="w-4 h-4"
              id="published"
            />
            <label htmlFor="published" className="text-sm font-medium">
              Publish
            </label>
          </div>

          <Button type="submit" className="w-full">
            {editingPost ? "Update Post" : "Create Post"}
          </Button>
        </form>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md p-6 text-center">
          <h1 className="text-2xl font-bold mb-4">Admin Access Required</h1>
          <p className="text-muted-foreground mb-6">Please log in to manage blog posts</p>
          <Button asChild>
            <a href="/auth">Login</a>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">Blog Posts</h1>
          <div className="flex items-center gap-2">
            <div 
              className={`w-2 h-2 rounded-full ${isAuthenticated ? 'bg-green-500' : 'bg-red-500'}`} 
              title={isAuthenticated ? 'Logged In' : 'Not Logged In'} 
            />
            <span className="text-sm text-muted-foreground">
              {isAuthenticated ? 'Logged In' : 'Logged Out'}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <a href="/auth">Login</a>
          </Button>
          <Button onClick={() => setIsEditing(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create New Post
          </Button>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="space-y-4">
          {posts?.map((post) => (
            <Card key={post.id} className="p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold">{post.title}</h2>
                  <p className="text-sm text-gray-500">
                    {new Date(post.createdAt).toLocaleDateString()}
                  </p>
                  <p className="mt-2 text-gray-700">{post.content}</p>
                  {post.imageUrl && (
                    <img
                      src={post.imageUrl}
                      alt={post.title}
                      className="mt-2 max-h-40 rounded-md"
                    />
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setEditingPost(post);
                      setIsEditing(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this post?')) {
                        deleteMutation.mutate(post.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
