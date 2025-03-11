import { Metadata } from "next";

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = (await params).slug;

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/v1/public/decks/${slug}`,
      {
        next: { revalidate: 0 },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch deck");
    }

    const data = await response.json();
    const deck = data.deck;

    const title = deck.title || "View PDF";
    const description = `View ${title} on Malak`;
    const previewImageUrl = `${
      process.env.NEXT_PUBLIC_APP_URL
    }/api/og?title=${encodeURIComponent(title)}`;

    return {
      metadataBase: new URL(
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      ),
      title: {
        default: title,
        template: `%s | Malak`,
      },
      description,
      openGraph: {
        title,
        description,
        images: [
          {
            url: previewImageUrl,
            width: 1200,
            height: 630,
            alt: title,
          },
        ],
        type: "article",
        siteName: "Malak",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [previewImageUrl],
        creator: "@malak",
      },
    };
  } catch (error) {
    // Fallback metadata if fetch fails
    return {
      metadataBase: new URL(
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      ),
      title: "View PDF - Malak",
      description: "View PDF document on Malak",
    };
  }
}

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
