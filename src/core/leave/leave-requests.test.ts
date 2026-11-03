// Leave Requests (ticket 23: Teacher leave). A Teacher asks to be away for a date range
// with a reason and an optional attachment; only an Admin approves or rejects it.
//
//   Teachers Huda, Omar and Sara (from `school()`). Today is 2026-10-15.
import { describe, expect, it } from "vitest";
import { school } from "../classes/test-school";
import { AccessDenied, InvalidInput, NotFound } from "../errors";
import {
  decideLeaveRequest,
  getLeaveAttachment,
  myLeaveRequests,
  submitLeaveRequest,
  teacherLeaveRequests,
} from "./leave-requests";

const bytes = (...parts: (string | number[])[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...Buffer.from(p)] : p)));
const pdf = { fileName: "sick-note.pdf", data: bytes("%PDF-1.7\n", "1 0 obj") };
const jpeg = { fileName: "note.jpg", data: bytes([0xff, 0xd8, 0xff, 0xe0], "JFIF") };
const png = { fileName: "note.png", data: bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "IHDR") };

async function leaveSchool() {
  return school({ now: "2026-10-15T09:00:00+04:00" });
}

const wedding = { startDate: "2026-11-02", endDate: "2026-11-04", reason: "Family wedding" };

describe("A Teacher's Leave Request", () => {
  it("a Teacher submits a Leave Request and sees it pending", async () => {
    const { app, huda } = await leaveSchool();

    await submitLeaveRequest(app.as(huda), {
      startDate: "2026-11-02",
      endDate: "2026-11-04",
      reason: "Family wedding",
    });

    expect(await myLeaveRequests(app.as(huda))).toEqual([
      {
        id: expect.any(Number),
        requester: "Huda",
        startDate: "2026-11-02",
        endDate: "2026-11-04",
        reason: "Family wedding",
        attachment: null,
        status: "pending",
        submittedAt: new Date("2026-10-15T09:00:00+04:00"),
        decidedBy: null,
        decidedAt: null,
      },
    ]);
  });

  it("a Leave Request must end on or after the day it starts, on real calendar dates", async () => {
    const { app, huda } = await leaveSchool();
    const asHuda = app.as(huda);
    const submit = (startDate: string, endDate: string) =>
      submitLeaveRequest(asHuda, { startDate, endDate, reason: "Medical appointment" });

    await expect(submit("2026-11-04", "2026-11-03")).rejects.toThrow(
      new InvalidInput("errors.leaveEndBeforeStart"),
    );
    await expect(submit("2026-02-30", "2026-03-02")).rejects.toThrow(new InvalidInput("errors.leaveDateInvalid"));
    await expect(submit("2026-11-02", "")).rejects.toThrow(new InvalidInput("errors.leaveDateInvalid"));

    await submit("2026-11-03", "2026-11-03"); // a single day is fine
    expect(await myLeaveRequests(asHuda)).toMatchObject([{ startDate: "2026-11-03", endDate: "2026-11-03" }]);
  });

  it("a Leave Request needs a reason of at most 1000 characters", async () => {
    const { app, huda } = await leaveSchool();
    const submit = (reason: string) =>
      submitLeaveRequest(app.as(huda), { startDate: "2026-11-02", endDate: "2026-11-02", reason });

    await expect(submit("   ")).rejects.toThrow(new InvalidInput("errors.leaveReasonRequired"));
    await expect(submit("x".repeat(1001))).rejects.toThrow(new InvalidInput("errors.leaveReasonTooLong"));

    await submit("  Dentist  ");
    expect(await myLeaveRequests(app.as(huda))).toMatchObject([{ reason: "Dentist" }]);
  });

  it("a Teacher attaches a PDF, JPEG or PNG and downloads it again", async () => {
    const { app, huda } = await leaveSchool();
    const asHuda = app.as(huda);
    const submit = (attachment: { fileName: string; data: Uint8Array }) =>
      submitLeaveRequest(asHuda, { startDate: "2026-11-02", endDate: "2026-11-02", reason: "Sick", attachment });

    const fromPdf = await submit(pdf);
    const fromJpeg = await submit(jpeg);
    const fromPng = await submit(png);

    expect(await getLeaveAttachment(asHuda, { leaveRequestId: fromPdf.id })).toEqual({
      fileName: "sick-note.pdf",
      contentType: "application/pdf",
      data: pdf.data,
    });
    expect(await getLeaveAttachment(asHuda, { leaveRequestId: fromJpeg.id })).toMatchObject({
      contentType: "image/jpeg",
    });
    expect(await getLeaveAttachment(asHuda, { leaveRequestId: fromPng.id })).toMatchObject({
      contentType: "image/png",
    });
    expect((await myLeaveRequests(asHuda)).map((r) => r.attachment)).toEqual([
      { fileName: "note.png" },
      { fileName: "note.jpg" },
      { fileName: "sick-note.pdf" },
    ]);
  });

  it("an attachment must be a PDF, JPEG or PNG of at most 5 MB", async () => {
    const { app, huda } = await leaveSchool();
    const submit = (attachment: { fileName: string; data: Uint8Array }) =>
      submitLeaveRequest(app.as(huda), { startDate: "2026-11-02", endDate: "2026-11-02", reason: "Sick", attachment });

    const docx = { fileName: "note.docx", data: bytes("PK", [3, 4], "word/document.xml") };
    await expect(submit(docx)).rejects.toThrow(new InvalidInput("errors.leaveAttachmentType"));
    // Named like a PDF, but isn't one.
    await expect(submit({ fileName: "note.pdf", data: bytes("<html>") })).rejects.toThrow(
      new InvalidInput("errors.leaveAttachmentType"),
    );
    await expect(submit({ fileName: "empty.pdf", data: new Uint8Array() })).rejects.toThrow(
      new InvalidInput("errors.leaveAttachmentType"),
    );
    const tooBig = new Uint8Array(5 * 1024 * 1024 + 1);
    tooBig.set(pdf.data);
    await expect(submit({ fileName: "scan.pdf", data: tooBig })).rejects.toThrow(
      new InvalidInput("errors.leaveAttachmentSize"),
    );
    expect(await myLeaveRequests(app.as(huda))).toEqual([]);

    const largest = new Uint8Array(5 * 1024 * 1024);
    largest.set(pdf.data);
    await submit({ fileName: "scan.pdf", data: largest });
    expect(await myLeaveRequests(app.as(huda))).toMatchObject([{ attachment: { fileName: "scan.pdf" } }]);
  });
});

describe("Deciding a Teacher's Leave Request", () => {
  it("the Admin approves a Teacher's Leave Request, and the Teacher sees who approved it and when", async () => {
    const { app, admin, huda } = await leaveSchool();
    const { id } = await submitLeaveRequest(app.as(huda), wedding);

    app.clock.set("2026-10-16T11:30:00+04:00");
    await decideLeaveRequest(app.as(admin), { leaveRequestId: id, decision: "approved" });

    expect(await myLeaveRequests(app.as(huda))).toMatchObject([
      { id, status: "approved", decidedBy: "Amina Office", decidedAt: new Date("2026-10-16T11:30:00+04:00") },
    ]);
  });

  it("only an Admin decides a Teacher's Leave Request: Teachers, including the requester, are refused", async () => {
    const { app, admin, huda, omar } = await leaveSchool();
    const { id } = await submitLeaveRequest(app.as(huda), wedding);
    const student = { role: "student" as const, userId: "some-student" };

    for (const actor of [huda, omar, student]) {
      await expect(decideLeaveRequest(app.as(actor), { leaveRequestId: id, decision: "approved" })).rejects.toThrow(
        AccessDenied,
      );
    }
    await expect(decideLeaveRequest(app.as(admin), { leaveRequestId: id + 1, decision: "approved" })).rejects.toThrow(
      NotFound,
    );
    expect(await myLeaveRequests(app.as(huda))).toMatchObject([{ id, status: "pending", decidedBy: null }]);
  });

  it("the Admin rejects a Leave Request, and can change a decision later", async () => {
    const { app, admin, huda } = await leaveSchool();
    const { id } = await submitLeaveRequest(app.as(huda), wedding);

    await decideLeaveRequest(app.as(admin), { leaveRequestId: id, decision: "rejected" });
    expect(await myLeaveRequests(app.as(huda))).toMatchObject([{ status: "rejected", decidedBy: "Amina Office" }]);

    app.clock.set("2026-10-17T08:00:00+04:00");
    await decideLeaveRequest(app.as(admin), { leaveRequestId: id, decision: "approved" });
    expect(await myLeaveRequests(app.as(huda))).toMatchObject([
      { status: "approved", decidedAt: new Date("2026-10-17T08:00:00+04:00") },
    ]);
  });
});

describe("The Admin's list of Teacher Leave Requests", () => {
  it("lists pending requests oldest first, then decided ones most recently decided first", async () => {
    const { app, admin, huda, omar, sara } = await leaveSchool();
    const at = (time: string) => app.clock.set(`2026-10-${time}+04:00`);
    at("15T09:00:00");
    const hudas = await submitLeaveRequest(app.as(huda), wedding);
    at("15T10:00:00");
    const omars = await submitLeaveRequest(app.as(omar), { ...wedding, reason: "Course" });
    at("15T11:00:00");
    const saras = await submitLeaveRequest(app.as(sara), { ...wedding, reason: "Moving house" });
    at("16T09:00:00");
    const omarsSecond = await submitLeaveRequest(app.as(omar), { ...wedding, reason: "Dentist" });
    at("17T09:00:00");
    await decideLeaveRequest(app.as(admin), { leaveRequestId: saras.id, decision: "approved" });
    at("17T10:00:00");
    await decideLeaveRequest(app.as(admin), { leaveRequestId: hudas.id, decision: "rejected" });

    const list = await teacherLeaveRequests(app.as(admin));

    expect(list.pending.map((r) => [r.id, r.requester])).toEqual([
      [omars.id, "Omar"],
      [omarsSecond.id, "Omar"],
    ]);
    expect(list.decided.map((r) => [r.id, r.requester, r.status])).toEqual([
      [hudas.id, "Huda", "rejected"],
      [saras.id, "Sara", "approved"],
    ]);
  });

  it("a Teacher is refused the list, and sees only their own requests", async () => {
    const { app, huda, omar } = await leaveSchool();
    await submitLeaveRequest(app.as(huda), wedding);
    await submitLeaveRequest(app.as(omar), { ...wedding, reason: "Course" });

    await expect(teacherLeaveRequests(app.as(huda))).rejects.toThrow(AccessDenied);
    expect((await myLeaveRequests(app.as(omar))).map((r) => r.reason)).toEqual(["Course"]);
  });
});

describe("Downloading a Leave Request's attachment", () => {
  it("the requester and the Admin download it; another Teacher or a Student is refused", async () => {
    const { app, admin, huda, omar } = await leaveSchool();
    const { id } = await submitLeaveRequest(app.as(huda), { ...wedding, attachment: pdf });
    const student = { role: "student" as const, userId: "some-student" };

    expect(await getLeaveAttachment(app.as(admin), { leaveRequestId: id })).toMatchObject({ fileName: "sick-note.pdf" });
    expect(await getLeaveAttachment(app.as(huda), { leaveRequestId: id })).toMatchObject({ fileName: "sick-note.pdf" });
    await expect(getLeaveAttachment(app.as(omar), { leaveRequestId: id })).rejects.toThrow(AccessDenied);
    await expect(getLeaveAttachment(app.as(student), { leaveRequestId: id })).rejects.toThrow(AccessDenied);
  });

  it("a request without an attachment has none, and an unknown request is not found", async () => {
    const { app, admin, huda } = await leaveSchool();
    const { id } = await submitLeaveRequest(app.as(huda), wedding);

    expect(await getLeaveAttachment(app.as(admin), { leaveRequestId: id })).toBeNull();
    await expect(getLeaveAttachment(app.as(admin), { leaveRequestId: id + 1 })).rejects.toThrow(NotFound);
    await expect(getLeaveAttachment(app.as(admin), { leaveRequestId: Number("x") })).rejects.toThrow(NotFound);
  });
});

describe("Who requests leave", () => {
  it("the Admin doesn't submit Leave Requests", async () => {
    const { app, admin } = await leaveSchool();

    await expect(submitLeaveRequest(app.as(admin), wedding)).rejects.toThrow(AccessDenied);
    await expect(myLeaveRequests(app.as(admin))).rejects.toThrow(AccessDenied);
  });
});
