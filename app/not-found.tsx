"use client";

import Link from "next/link";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { RiArrowGoBackLine, RiSlideshowLine } from "@remixicon/react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-foreground">
      <Card className="w-full max-w-md border-primary/20 shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-muted">
            <RiSlideshowLine className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold">404</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="mb-2 text-xl font-semibold">Deck Not Found</p>
          <p className="text-muted-foreground">
            The presentation deck you're looking for doesn't exist or has been
            moved.
          </p>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Link href="/" passHref>
            <Button className="gap-2">
              <RiArrowGoBackLine className="h-4 w-4" />
              Return to Decks
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
