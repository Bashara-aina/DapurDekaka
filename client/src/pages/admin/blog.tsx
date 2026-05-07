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
import { Pencil, Trash2, Plus, Image as ImageIcon, Loader2, ChevronUp, ChevronDown, Star } from "lucide-react";

import AdminLayout from "@/components/layout/AdminLayout";
import AdminNavbar from "@/components/layout/admin-navbar";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const BLOG_CATEGORIES = [
  "dim sum",
  "recipes",
  "cooking tips",
  "food culture",
  "halal",
  "reviews",
  "news",
  "other"
] as const;

export default function AdminBlogPage() {
  const { t } = useLanguage();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [localBlogPosts, setLocalBlogPosts] = useState<BlogPost[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query for fetching posts
  const { data: posts, isLoading: postsLoading } = useQuery<BlogPost[]>({
    queryKey: queryKeys.admin.blog,
    queryFn: () => apiRequest("/api/blog"),
    enabled: !!isAuthenticated,
  });

  // Define mutations at the top level
  const createMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return await apiRequest("/api/blog", {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.blog });
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
      return await apiRequest(`/api/blog/${id}`, {
        method: "PUT",
        body: formData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.blog });
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
      await apiRequest(`/api/blog/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.blog });
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
      return await apiRequest("/api/blog/reorder", {
        method: "POST",
        body: JSON.stringify({ postIds }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.blog });
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

  // Handle moving post up or down
  const handleMovePost = async (postId: number, direction: 'up' | 'down') => {
    const currentIndex = localBlogPosts.findIndex(post => post.id === postId);

    if (currentIndex === -1) return;

    // Cannot move first post up or last post down
    if (
      (direction === 'up' && currentIndex === 0) ||
      (direction === 'down' && currentIndex === localBlogPosts.length - 1)
    ) {
      return;
    }

    // Calculate new index
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    // Update local state for immediate UI feedback
    const newPosts = [...localBlogPosts];
    // Remove item from current position
    const [movedPost] = newPosts.splice(currentIndex, 1);
    // Insert item at new position
    newPosts.splice(newIndex, 0, movedPost);
    setLocalBlogPosts(newPosts);

    // Send reorder request to server
    try {
      const postIds = newPosts.map(post => post.id);
      await reorderMutation.mutateAsync(postIds);

      // Refresh data from server
      queryClient.invalidateQueries({ queryKey: ["/api/blog"] });

      toast({
        title: `Post moved ${direction}`,
        variant: "default"
      });
    } catch (error) {
      console.error(`Error moving post ${direction}:`, error);
      toast({
        title: `Failed to move post ${direction}`,
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });

      // Revert to original order if server update fails
      setLocalBlogPosts(posts || []);
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
    formData.set('featured', formData.get('featured') ? '1' : '0');

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
      <AdminLayout showNavbar={false}>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">
            {editingPost ? t("admin.blog.editPost") : t("admin.blog.createPost")}
          </h1>
          <Button onClick={() => {
            setIsEditing(false);
            setEditingPost(null);
            setImagePreview(null);
          }}>
            {t("admin.blog.backToPosts")}
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("admin.blog.titleLabel")} *</label>
            <Input
              name="title"
              defaultValue={editingPost?.title}
              required
              minLength={3}
              placeholder={t("admin.blog.titlePlaceholder")}
              className="text-xl"
            />
          </div>

          {/* Author Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("admin.blog.authorNameLabel")}</label>
            <Input
              name="authorName"
              defaultValue={editingPost?.authorName || ''}
              placeholder={t("admin.blog.authorNamePlaceholder")}
            />
          </div>

          {/* Slug */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("admin.blog.slugLabel")}</label>
            <Input
              name="slug"
              defaultValue={editingPost?.slug || ''}
              placeholder={t("admin.blog.slugPlaceholder")}
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("admin.blog.categoryLabel")}</label>
            <select
              name="category"
              defaultValue={editingPost?.category || ''}
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">{t("admin.blog.categoryPlaceholder")}</option>
              {BLOG_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Image Upload */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("admin.blog.imageLabel")}</label>
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

          {/* Excerpt */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("admin.blog.excerptLabel")}</label>
            <Textarea
              name="excerpt"
              defaultValue={editingPost?.excerpt || ''}
              placeholder={t("admin.blog.excerptPlaceholder")}
              rows={3}
            />
          </div>

          {/* Content Editor */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("admin.blog.contentLabel")} *</label>
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

          {/* Publish and Featured toggles */}
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center space-x-2">
              <Input
                type="checkbox"
                name="published"
                defaultChecked={editingPost?.published === 1}
                className="w-4 h-4"
                id="published"
              />
              <label htmlFor="published" className="text-sm font-medium">
                {t("admin.blog.published")}
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Input
                type="checkbox"
                name="featured"
                defaultChecked={editingPost?.featured === 1}
                className="w-4 h-4"
                id="featured"
              />
              <label htmlFor="featured" className="text-sm font-medium">
                {t("admin.blog.featuredLabel")}
              </label>
            </div>
          </div>

          {/* Read time display (computed) */}
          {editingPost?.readTime && (
            <div className="text-sm text-muted-foreground">
              {t("admin.blog.readTimeLabel")}: {editingPost.readTime} min
            </div>
          )}

          <Button type="submit" className="w-full">
            {editingPost ? t("admin.blog.updatePost") : t("admin.blog.createPost")}
          </Button>
        </form>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">{t("admin.blog.title")}</h1>
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${isAuthenticated ? 'bg-green-500' : 'bg-red-500'}`}
              title={isAuthenticated ? t('admin.blog.loggedIn') : t('admin.blog.loggedOut')}
            />
            <span className="text-sm text-muted-foreground">
              {isAuthenticated ? t('admin.blog.loggedIn') : t('admin.blog.loggedOut')}
            </span>
          </div>
        </div>
        <Button onClick={() => setIsEditing(true)}>
          <Plus className="w-4 h-4 mr-2" />
          {t("admin.blog.createNew")}
        </Button>
      </div>

      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground mb-2">{t("admin.blog.useArrowsToReorder")}</p>
          {localBlogPosts.map((post, index) => (
            <Card key={post.id} className="p-6 border border-gray-200 hover:border-primary transition-colors mb-4">
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    {post.featured === 1 && (
                      <Star className="w-4 h-4 text-yellow-500" style={{ fill: "yellow" }} aria-label="Featured" />
                    )}
                    <h2 className="text-xl font-semibold">{post.title}</h2>
                  </div>
                  {post.authorName && (
                    <p className="text-sm text-gray-500">By {post.authorName}</p>
                  )}
                  {post.category && (
                    <span className="inline-block px-2 py-1 text-xs bg-gray-100 rounded-full">
                      {post.category}
                    </span>
                  )}
                  <p className="text-sm text-gray-500">
                    {new Date(post.createdAt).toLocaleDateString()}
                    {post.readTime && ` · ${post.readTime} min read`}
                  </p>
                  {post.excerpt && (
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">{post.excerpt}</p>
                  )}
                  {post.imageUrl && (
                    <img
                      src={post.imageUrl}
                      alt={post.title}
                      className="mt-2 max-h-40 rounded-md"
                    />
                  )}
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <div className="flex flex-col justify-center items-center space-y-1 mb-4">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleMovePost(post.id, 'up')}
                      disabled={index === 0}
                      title={t("admin.blog.moveUp")}
                      className={index === 0 ? "opacity-50 cursor-not-allowed" : ""}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-center text-muted-foreground">
                      Order
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleMovePost(post.id, 'down')}
                      disabled={index === localBlogPosts.length - 1}
                      title={t("admin.blog.moveDown")}
                      className={index === localBlogPosts.length - 1 ? "opacity-50 cursor-not-allowed" : ""}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        setEditingPost(post);
                        setIsEditing(true);
                      }}
                      title="Edit post"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        if (confirm(t('admin.blog.deleteConfirm'))) {
                          deleteMutation.mutate(post.id);
                        }
                      }}
                      title="Delete post"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </AdminLayout>
  );
}