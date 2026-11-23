// @vitest-environment node
import {
    parseProfileInput,
    parseProfileXml,
    parseSummaryAnswer,
    parseVanityAnswer,
    profileXmlUrl,
    summaryApiUrl,
    vanityApiUrl,
} from "@/lib/steam-profile";
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

describe("Steam Web API", () => {
    it("builds the two endpoints with the key encoded", () => {
        expect(vanityApiUrl("K&1", "ace")).toBe(
            "https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=K%261&vanityurl=ace",
        );
        expect(summaryApiUrl("K", ID)).toBe(
            `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=K&steamids=${ID}`,
        );
    });

    it("reads a resolved vanity name", () => {
        expect(parseVanityAnswer({ response: { success: 1, steamid: ID } })).toBe(ID);
        expect(parseVanityAnswer({ response: { success: 42, message: "No match" } })).toBeNull();
        expect(parseVanityAnswer({ response: { success: 1, steamid: 7 } })).toBeNull();
        expect(parseVanityAnswer({ response: { success: 1, steamid: "123" } })).toBeNull();
        expect(parseVanityAnswer(null)).toBeNull();
        expect(parseVanityAnswer({})).toBeNull();
    });

    it("reads the player summary", () => {
        const answer = { response: { players: [null, { steamid: ID, personaname: "Ace", avatarmedium: AVATAR }] } };
        expect(parseSummaryAnswer(answer, ID)).toEqual({
            id64: ID,
            name: "Ace",
            avatar: AVATAR,
            url: `https://steamcommunity.com/profiles/${ID}`,
        });
        const noAvatar = {
            response: { players: [{ steamid: ID, personaname: "Ace", avatarmedium: "http://x/a.jpg" }] },
        };
        expect(parseSummaryAnswer(noAvatar, ID)?.avatar).toBeNull();
        expect(parseSummaryAnswer({ response: { players: [] } }, ID)).toBeNull();
        expect(parseSummaryAnswer({ response: { players: [{ steamid: ID }] } }, ID)).toBeNull();
        expect(parseSummaryAnswer({ response: {} }, ID)).toBeNull();
        expect(parseSummaryAnswer("x", ID)).toBeNull();
    });
});
