import { Metadata, ResolvingMetadata } from 'next';

type Props = {
  params: { slug: string };
  children?: React.ReactNode;
}

export async function generateMetadata(
  { params }: { params: { slug: string } },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const slug = params.slug;

  // Fetch deck data
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/public/decks/${slug}`);
    const data = await response.json();
    const deck = data.deck;

    const title = deck.title || 'View PDF';
    const description = `View ${title} on Malak`;

    // Generate preview image URL - you can implement this based on your needs
    const previewImageUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/og?title=${encodeURIComponent(title)}`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        images: [previewImageUrl],
        type: 'article',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [previewImageUrl],
      },
    };
  } catch (error) {
    // Fallback metadata if fetch fails
    return {
      title: 'View PDF - Malak',
      description: 'View PDF document on Malak',
    };
  }
}

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children;
} 