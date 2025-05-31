"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

// Form schema with validation
const formSchema = z.object({
  name: z.string().min(2, { message: "İsim en az 2 karakter olmalıdır" }),
  company: z.string().min(2, { message: "Şirket adı en az 2 karakter olmalıdır" }),
  email: z.string().email({ message: "Geçerli bir e-posta adresi giriniz" }),
  phone: z.string().min(10, { message: "Geçerli bir telefon numarası giriniz" }).optional(),
  message: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface LeadFormProps {
  apiEndpoint?: string;
}

export function LeadForm({ apiEndpoint = "/api/leads" }: LeadFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize the form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      company: "",
      email: "",
      phone: "",
      message: "",
    },
  });

  // Form submission handler
  async function onSubmit(data: FormValues) {
    setIsSubmitting(true);
    
    try {
      // Make sure we have an API endpoint
      if (!apiEndpoint) {
        throw new Error("API endpoint not specified");
      }
      
      // Make the actual API call
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error("API isteği başarısız oldu");
      }
      
      toast.success("Teşekkürler! En kısa sürede sizinle iletişime geçeceğiz.");
      form.reset();
    } catch (error) {
      console.error("Form submission error:", error);
      toast.error("Bir hata oluştu. Lütfen daha sonra tekrar deneyin.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>İletişim Formu</CardTitle>
        <CardDescription>
          Bilgilerinizi doldurun, size hemen dönüş yapalım.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ad Soyad</FormLabel>
                  <FormControl>
                    <Input placeholder="Ad Soyad" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="company"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Şirket</FormLabel>
                  <FormControl>
                    <Input placeholder="Şirket Adı" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-posta</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="E-posta" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefon (Opsiyonel)</FormLabel>
                  <FormControl>
                    <Input placeholder="Telefon Numarası" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mesaj (Opsiyonel)</FormLabel>
                  <FormControl>
                    <Input placeholder="Mesajınız" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Gönderiliyor..." : "Gönder"}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="text-xs text-center text-muted-foreground">
        Bilgileriniz gizli tutulacak ve sadece sizinle iletişim amacıyla kullanılacaktır.
      </CardFooter>
    </Card>
  );
}