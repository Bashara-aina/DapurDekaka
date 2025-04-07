import { useState, useEffect } from "react";
import { Editor } from '@tinymce/tinymce-react';
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BlogPost } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Pencil, Trash2, Plus, Image as ImageIcon, Loader2, MoveVertical } from "lucide-react";
import { useLocation } from "wouter";
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import { 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  arrayMove
} from '@dnd-kit/sortable';
import { SortableItem } from "@/components/ui/SortableItem";

import AdminNavbar from "@/components/layout/admin-navbar";

export default function AdminBlogPage() {
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [localBlogPosts, setLocalBlogPosts] = useState<BlogPost[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  
  // Define sensors for drag-and-drop functionality
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  // Auth check query
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
    staleTime: 0, // Don't cache the auth check
    gcTime: 0     // Updated from cacheTime to gcTime for TanStack Query v5
  });

  // Force redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation('/auth');
    }
  }, [authLoading, isAuthenticated, setLocation]);

  // Query for fetching posts
  const { data: posts, isLoading: postsLoading } = useQuery<BlogPost[]>({
    queryKey: ["/api/blog"],
    queryFn: async () => {
      const response = await fetch("/api/blog");
      if (!response.ok) throw new Error("Failed to fetch posts");
      return response.json();
    },
    enabled: !!isAuthenticated, // Only run this query if authenticated
  });

  // Define mutations at the top level
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
  
  // Mutation for reordering blog posts
  const reorderMutation = useMutation({
    mutationFn: async (postIds: number[]) => {
      const response = await fetch("/api/blog/reorder", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ postIds }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to reorder blog posts");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blog"] });
      toast({ 
        title: "Blog posts reordered successfully",
        variant: "default"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Update localBlogPosts when posts data changes
  useEffect(() => {
    if (posts) {
      setLocalBlogPosts(posts);
    }
  }, [posts]);

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

  // Handle drag end for blog posts reordering
  const handleBlogPostDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      // Find indices of the dragged item and the drop target
      const oldIndex = localBlogPosts.findIndex(post => post.id === active.id);
      const newIndex = localBlogPosts.findIndex(post => post.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        // Update local state for immediate UI feedback
        const newPosts = arrayMove(localBlogPosts, oldIndex, newIndex);
        setLocalBlogPosts(newPosts);
        
        // Send reorder request to server
        try {
          const postIds = newPosts.map(post => post.id);
          await reorderMutation.mutateAsync(postIds);
          
          // Refresh data from server
          queryClient.invalidateQueries({ queryKey: ["/api/blog"] });
        } catch (error) {
          console.error('Error reordering blog posts:', error);
          toast({ 
            title: "Failed to reorder blog posts", 
            description: error instanceof Error ? error.message : "Unknown error",
            variant: "destructive" 
          });
          
          // Revert to original order if server update fails
          setLocalBlogPosts(posts || []);
        }
      }
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

  // Show loading state
  if (authLoading || postsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Redirect if not authenticated
  if (!isAuthenticated) {
    return null;
  }

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
            {(imagePreview || editingPost?.imageUrl) && (
              <div className="mt-4">
                <img
                  src={imagePreview || editingPost?.imageUrl || ''}
                  alt="Preview"
                  className="max-h-[400px] w-full object-cover rounded-lg"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Content *</label>
            <Editor
              apiKey={import.meta.env.VITE_TINYMCE_API_KEY}
              init={{
                height: 500,
                menubar: true,
                setup: (editor) => {
                  editor.on('init', () => {
                    if (editingPost?.content) {
                      editor.setContent(editingPost.content);
                    }
                  });
                },
                plugins: [
                  'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                  'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                  'insertdatetime', 'media', 'table', 'help', 'wordcount'
                ],
                toolbar: 'undo redo | blocks | ' +
                  'bold italic | alignleft aligncenter ' +
                  'alignright alignjustify | bullist numlist outdent indent | ' +
                  'removeformat | help',
                content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }'
              }}
              initialValue={editingPost?.content || ''}
              textareaName="content"
              onEditorChange={(content) => {
                const textarea = document.querySelector('textarea[name="content"]');
                if (textarea) {
                  (textarea as HTMLTextAreaElement).value = content;
                }
              }}
            />
            <textarea name="content" defaultValue={editingPost?.content} hidden />
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

  return (
    <>
      <AdminNavbar />
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
        <Button onClick={() => setIsEditing(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create New Post
        </Button>
      </div>

      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground mb-2">Drag posts to change their order.</p>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleBlogPostDragEnd}
          >
            <SortableContext
              items={localBlogPosts.map(post => post.id)}
              strategy={verticalListSortingStrategy}
            >
              {localBlogPosts.map((post) => (
                <SortableItem key={post.id} id={post.id}>
                  <Card className="p-6 border-2 border-dashed border-gray-200 hover:border-primary transition-colors mb-4">
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-2 flex-1">
                        <h2 className="text-xl font-semibold">{post.title}</h2>
                        <p className="text-sm text-gray-500">
                          {new Date(post.createdAt).toLocaleDateString()}
                        </p>
                        <div className="mt-2 text-gray-700 prose max-w-none" dangerouslySetInnerHTML={{ __html: post.content }} />
                        {post.imageUrl && (
                          <img
                            src={post.imageUrl}
                            alt={post.title}
                            className="mt-2 max-h-40 rounded-md"
                          />
                        )}
                      </div>
                      <div className="flex flex-col gap-2 flex-shrink-0">
                        <div className="flex items-center text-muted-foreground mb-2">
                          <MoveVertical className="w-4 h-4 mr-1" />
                          <span className="text-xs">Drag to reorder</span>
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
                    </div>
                  </Card>
                </SortableItem>
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </ScrollArea>
    </div>
    </>
  );
}