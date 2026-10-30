// A Student's profile, shown to the Admin and to the Student themselves.
import type { StudentProfile } from "@/core/students/student-profile";
import { t, type MessageKey } from "@/i18n";

export function StudentProfileCard({ profile }: { profile: StudentProfile }) {
  const rows: [MessageKey, string][] = [
    ["students.studentNumber", profile.studentNumber],
    ["students.dateOfBirth", profile.dateOfBirth],
    ["students.nationalId", profile.nationalId],
    ["students.guardianContact", profile.guardianContact],
    ["students.email", profile.email ?? t("studentProfile.noEmail")],
    ["students.admissionDate", profile.admissionDate],
  ];
  return (
    <section className="card profile">
      {profile.hasPhoto ? (
        // A plain <img>: the photo comes from our own access-checked route, not next/image.
        <img
          className="profile-photo"
          src={`/students/${profile.id}/photo`}
          alt={t("studentProfile.photoAlt", { name: profile.name })}
        />
      ) : (
        <p className="muted">{t("studentProfile.noPhoto")}</p>
      )}
      <h2>{profile.name}</h2>
      {profile.disabled && <p className="muted">{t("students.disabled")}</p>}
      <dl className="details">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{t(label)}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
