// @vitest-environment node
import { parseProfileInput, parseProfileXml, profileXmlUrl } from "@/lib/steam-profile";
import { describe, expect, it } from "vitest";

const ID = "76561197960287930";

describe("parseProfileInput", () => {
    it("reads profile links in their usual shapes", () => {
        expect(parseProfileInput(` https://steamcommunity.com/profiles/${ID}/ `)).toEqual({ kind: "id64", id: ID });
        expect(parseProfileInput(`http://www.steamcommunity.com/profiles/${ID}`)).toEqual({ kind: "id64", id: ID });
        expect(parseProfileInput("steamcommunity.com/id/sharp_eye-1")).toEqual({ kind: "vanity", id: "sharp_eye-1" });
        expect(parseProfileInput("https://steamcommunity.com/id/Ace?l=french")).toEqual({ kind: "vanity", id: "Ace" });
        expect(parseProfileInput(ID)).toEqual({ kind: "id64", id: ID });
    });

    it("rejects anything that is not a Steam profile", () => {
        for (const input of [
            "",
            "http://[bad",
            "https://example.com/id/ace",
            "https://steamcommunity.com/",
            "https://steamcommunity.com/id/",
            "https://steamcommunity.com/id/a",
            "https://steamcommunity.com/id/ace/games",
            "https://steamcommunity.com/profiles/123",
            "https://steamcommunity.com/groups/ace",
            "12345678901234567",
        ]) {
            expect(parseProfileInput(input), input).toBeNull();
        }
    });
});

describe("profileXmlUrl", () => {
    it("points at the public XML view", () => {
        expect(profileXmlUrl({ kind: "id64", id: ID })).toBe(`https://steamcommunity.com/profiles/${ID}/?xml=1`);
        expect(profileXmlUrl({ kind: "vanity", id: "ace" })).toBe("https://steamcommunity.com/id/ace/?xml=1");
    });
});

const AVATAR = "https://avatars.fastly.steamstatic.com/6aaf12ca7dd4466dfd48c5b032efddca9c9d636a_medium.jpg";
const xml = (body: string) => `<?xml version="1.0" encoding="UTF-8"?><profile>${body}</profile>`;

describe("parseProfileXml", () => {
    it("reads the id, persona name and medium avatar", () => {
        const page = xml(
            `<steamID64>${ID}</steamID64><steamID><![CDATA[Sharp Eye ✦]]></steamID><avatarMedium><![CDATA[${AVATAR}]]></avatarMedium>`,
        );
        expect(parseProfileXml(page)).toEqual({
            id64: ID,
            name: "Sharp Eye ✦",
            avatar: AVATAR,
            url: `https://steamcommunity.com/profiles/${ID}`,
        });
    });

    it("drops an avatar that is not on Steam's CDN", () => {
        const page = xml(
            `<steamID64>${ID}</steamID64><steamID><![CDATA[Ace]]></steamID><avatarMedium><![CDATA[https://evil.example/a.jpg]]></avatarMedium>`,
        );
        expect(parseProfileXml(page)?.avatar).toBeNull();
        expect(
            parseProfileXml(xml(`<steamID64>${ID}</steamID64><steamID><![CDATA[Ace]]></steamID>`))?.avatar,
        ).toBeNull();
    });

    it("rejects error pages and malformed answers", () => {
        expect(parseProfileXml("<response><error><![CDATA[not found]]></error></response>")).toBeNull();
        expect(parseProfileXml(xml("<steamID><![CDATA[Ace]]></steamID>"))).toBeNull();
        expect(parseProfileXml(xml("<steamID64>123</steamID64><steamID><![CDATA[Ace]]></steamID>"))).toBeNull();
        expect(parseProfileXml(xml(`<steamID64>${ID}</steamID64>`))).toBeNull();
    });
});
