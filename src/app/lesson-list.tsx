// Lessons grouped by day (the rows arrive newest day first, then by Period), each
// with its Period, Subject, Teacher, topic and homework. Used by the class summary
// (Admin and Class Teacher) and by a Class Subject's page.
import type { LessonRow } from "@/core/lessons/lessons";
import { t } from "@/i18n";

export function LessonList({ lessons }: { lessons: LessonRow[] }) {
  if (lessons.length === 0) return <p>{t("lessons.none")}</p>;

  const days: { date: string; lessons: LessonRow[] }[] = [];
  for (const lesson of lessons) {
    const day = days.at(-1);
    if (day?.date === lesson.date) day.lessons.push(lesson);
    else days.push({ date: lesson.date, lessons: [lesson] });
  }

  return days.map((day) => (
    <section key={day.date} className="lesson-day" aria-label={day.date}>
      <h3>{day.date}</h3>
      <ul className="list">
        {day.lessons.map((lesson) => (
          <li key={lesson.id}>
            <div className="muted">
              {t("lessons.line", { period: lesson.period, subject: lesson.subject, teacher: lesson.teacher })}
            </div>
            <div className="lesson-topic">{lesson.topic}</div>
            {lesson.homework && (
              <div className="muted lesson-topic">{t("lessons.homeworkLine", { homework: lesson.homework })}</div>
            )}
          </li>
        ))}
      </ul>
    </section>
  ));
}
