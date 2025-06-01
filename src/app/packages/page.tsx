'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import Navbar from '@/components/auth/navbar';

const packages = [
	{
		id: 'free',
		name: 'Ücretsiz',
		price: '0 ₺',
		description: 'Temel özellikler ile başlayın',
		features: ['Aylık 100 işletme arama', 'Temel istatistikler', 'Excel dışa aktarma'],
	},
	{
		id: 'pro',
		name: 'Profesyonel',
		price: '199 ₺/ay',
		description: 'İşletmenizi büyütün',
		features: [
			'Sınırsız işletme arama',
			'Detaylı analiz ve raporlar',
			'Otomatik veri güncelleme',
			'Öncelikli destek',
		],
	},
	{
		id: 'enterprise',
		name: 'Kurumsal',
		price: '499 ₺/ay',
		description: 'Tam kapsamlı çözüm',
		features: [
			'Tüm Pro özellikleri',
			'API erişimi',
			'Özel entegrasyonlar',
			'7/24 öncelikli destek',
			'Özel raporlama',
		],
	},
];

export default function PackagesPage() {
	const { data: session, update } = useSession();
	const router = useRouter();
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		// Debug logging to understand session state
		console.log('Current session state:', {
			user: session?.user,
			firstLogin: session?.user?.first_login,
			package: session?.user?.package
		});
		
		// Only redirect if the user has already selected a package AND it's not their first login
		if (session?.user && 
			session.user.package && 
			session.user.package !== '' && 
			session.user.first_login === false) {
			console.log("User already has package and not first login, redirecting to home");
			router.push('/');
		}
	}, [session, router]);

	// Function to check if user has already selected this package
	const hasSelectedPackage = (packageId: string) => {
		return session?.user?.package === packageId;
	};

	const handleSelectPackage = async (packageId: string) => {
		try {
			// Prevent redundant API calls - check if this is already user's package
			if (session?.user?.package === packageId && session?.user?.first_login === false) {
				console.log('User already has this package and first_login is false, redirecting to home');
				toast.info('Bu paket zaten hesabınızda aktif');
				router.push('/');
				return;
			}
			
			setLoading(true);
			console.log('Sending request payload:', { packageId });
			
			// Use absolute URL to ensure we're hitting the API endpoint
			const origin = window.location.origin;
			const apiUrl = `${origin}/api/user/select-package`;
			console.log('API URL:', apiUrl);

			// Check if user is authenticated
			if (!session?.user) {
				console.error('User not authenticated');
				toast.error('Oturum açmanız gerekiyor');
				router.push('/login');
				setLoading(false);
				return;
			}

			// Send the request
			const response = await fetch(apiUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ packageId }),
				credentials: 'include'
			});
			
			// Log response status for debugging
			console.log('Response status:', response.status);
			
			if (!response.ok) {
				const errorText = await response.text();
				console.error('Error response:', errorText);
				setLoading(false);
				toast.error('Paket seçimi başarısız oldu');
				return;
			}
			
			const data = await response.json();
			console.log('Response data:', data);
			
			if (!data.success) {
				console.error('Package selection failed:', data.message);
				setLoading(false);
				toast.error(data.message || 'Paket seçimi başarısız oldu');
				return;
			}
			
			// Show success message
			toast.success('Paket başarıyla seçildi');
			
			// Clear the loading state
			setLoading(false);
			
			// Force complete session reset by logging out and redirecting to login
			// This is a more drastic approach but ensures the session gets completely refreshed
			try {
				// Signout URL
				const signOutUrl = `${origin}/api/auth/signout`;
				
				// Perform signout request
				await fetch(signOutUrl, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ callbackUrl: '/' }),
				});
				
				// Wait briefly then reload the page to complete the process
				setTimeout(() => {
					window.location.href = '/';
				}, 1000);
			} catch (error) {
				console.error('Error during signout:', error);
				// As a fallback, just reload the page
				window.location.href = '/';
			}
		} catch (error) {
			console.error('Error selecting package:', error);
			setLoading(false);
			toast.error(error instanceof Error ? error.message : 'Bir hata oluştu');
		}
	};

	return (
		<>
			<Navbar />
			<main className="min-h-screen bg-white">
				<div className="container px-4 max-w-6xl mx-auto py-24">
					<div className="text-center space-y-4 mb-12">
						<h1 className="text-4xl font-bold tracking-tight">Paket Seçin</h1>
						<p className="text-zinc-500 max-w-2xl mx-auto">
							İhtiyaçlarınıza en uygun paketi seçerek Crawlify'ın güçlü özelliklerinden
							yararlanmaya başlayın.
						</p>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
						{packages.map((pkg) => (
							<Card key={pkg.id} className="flex flex-col">
								<CardHeader>
									<CardTitle>
										<div className="flex flex-col items-center text-center">
											<h3 className="text-xl font-semibold">{pkg.name}</h3>
											<p className="text-3xl font-bold mt-4">{pkg.price}</p>
										</div>
									</CardTitle>
								</CardHeader>
								<CardContent className="flex-1">
									<p className="text-zinc-500 text-center mb-6">
										{pkg.description}
									</p>
									<ul className="space-y-3">
										{pkg.features.map((feature, index) => (
											<li key={index} className="flex items-center">
												<svg
													className="h-5 w-5 text-green-500 mr-2"
													fill="none"
													strokeWidth="2"
													stroke="currentColor"
													viewBox="0 0 24 24"
												>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														d="M5 13l4 4L19 7"
													/>
												</svg>
												<span className="text-zinc-600">{feature}</span>
											</li>
										))}
									</ul>
								</CardContent>
								<CardFooter>
									{hasSelectedPackage(pkg.id) ? (
										<div className="w-full text-center py-2 bg-gray-100 rounded-md">
											<span className="text-green-600 font-medium flex items-center justify-center">
												<svg
													className="h-5 w-5 mr-1"
													fill="none"
													strokeWidth="2"
													stroke="currentColor"
													viewBox="0 0 24 24"
												>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														d="M5 13l4 4L19 7"
													/>
												</svg>
												Seçili Paket
											</span>
										</div>
									) : (
										<Button
											className="w-full"
											variant={pkg.id === 'free' ? 'outline' : 'default'}
											onClick={() => handleSelectPackage(pkg.id)}
											disabled={loading}
										>
											{loading ? 'Yükleniyor...' : pkg.id === 'free' ? 'Ücretsiz Başla' : 'Paketi Seç'}
										</Button>
									)}
								</CardFooter>
							</Card>
						))}
					</div>
				</div>
			</main>
		</>
	);
}