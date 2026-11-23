// Click-to-play clip facade: nothing from the provider before the click, its player after.
import { ClipPlayer } from "@/components/home/ClipPlayer";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

// next/image needs the Next runtime: a plain <img> keeps the props under test.
vi.mock("next/image", () => ({
    default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className={className} />
    ),
}));

let root: Root | null = null;
let container: HTMLDivElement;

function render() {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() =>
        root!.render(
            <ClipPlayer
                title="M4A1-S 4K on Cbble"
                thumbnail="https://cdn.example/thumb.jpg"
                embed="https://player.example/clips/abc/embed"
                playLabel="Play the clip M4A1-S 4K on Cbble"
            />,
        ),
    );
}

afterEach(() => {
    act(() => root?.unmount());
    root = null;
    container.remove();
});

describe("ClipPlayer", () => {
    it("shows the thumbnail behind a labelled play button, without any iframe", () => {
        render();
        const button = container.querySelector("button.clip-player__poster");
        expect(button?.getAttribute("aria-label")).toBe("Play the clip M4A1-S 4K on Cbble");
        expect(container.querySelector("img")?.getAttribute("src")).toBe("https://cdn.example/thumb.jpg");
        expect(container.querySelector("iframe")).toBeNull();
    });

    it("loads the provider's player in place of the poster on click", () => {
        render();
        act(() => (container.querySelector("button") as HTMLButtonElement).click());
        const frame = container.querySelector("iframe");
        expect(frame?.getAttribute("src")).toBe("https://player.example/clips/abc/embed");
        expect(frame?.getAttribute("title")).toBe("M4A1-S 4K on Cbble");
        expect(container.querySelector("button")).toBeNull();
    });
});
