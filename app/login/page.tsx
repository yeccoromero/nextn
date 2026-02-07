'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, useUser } from '@/firebase';
import { FirebaseError } from 'firebase/app';
import { useToast } from '@/hooks/use-toast';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { Chrome } from 'lucide-react';

const signInSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});

type SignInFormValues = z.infer<typeof signInSchema>;

export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!isUserLoading && user) {
      router.replace('/');
    }
  }, [user, isUserLoading, router]);

  const {
    register: registerSignIn,
    handleSubmit: handleSignInSubmit,
    formState: { errors: signInErrors },
  } = useForm<SignInFormValues>({ resolver: zodResolver(signInSchema) });

  const handleAuthError = (error: any) => {
    if (error instanceof FirebaseError) {
      setAuthError(error.message);
    } else {
      setAuthError('An unknown error occurred.');
    }
  };
  
  const onSignIn = async (data: SignInFormValues) => {
    try {
      await signInWithEmailAndPassword(auth, data.email, data.password);
    } catch (error) {
      handleAuthError(error);
    }
  };

  const onSignInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      handleAuthError(error);
    }
  };

  useEffect(() => {
    if (authError) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: authError,
      });
      setAuthError(null);
    }
  }, [authError, toast]);


  if (isUserLoading || user) {
    return <div className="flex h-screen w-screen items-center justify-center bg-canvas">Loading...</div>;
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <Card className="w-[400px]">
        <CardHeader className="text-center">
          <CardTitle>Welcome to Vectoria</CardTitle>
          <CardDescription>Sign in to create and manage your vector graphics.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button variant="outline" className="w-full" onClick={onSignInWithGoogle}>
              <Chrome className="mr-2 h-4 w-4" />
              Sign in with Google
            </Button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>
            <form onSubmit={handleSignInSubmit(onSignIn)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-signin">Email</Label>
                <Input id="email-signin" type="email" placeholder="m@example.com" {...registerSignIn('email')} />
                {signInErrors.email && <p className="text-xs text-destructive">{signInErrors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password-signin">Password</Label>
                <Input id="password-signin" type="password" {...registerSignIn('password')} />
                {signInErrors.password && <p className="text-xs text-destructive">{signInErrors.password.message}</p>}
              </div>
              <Button type="submit" className="w-full">Sign In with Email</Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
