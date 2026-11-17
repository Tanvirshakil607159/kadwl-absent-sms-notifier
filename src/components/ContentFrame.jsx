import { useId } from "react";
import Dialog from "./Dialog";
export default function ContentFrame({
  embedded = false,
  title,
  description,
  children,
  footer,
  ...dialogProps
}) {
  const id = useId();
  if (!embedded)
    return (
      <Dialog
        title={title}
        description={description}
        footer={footer}
        {...dialogProps}
      >
        {children}
      </Dialog>
    );
  return (
    <section className="panel section-content" aria-labelledby={id}>
      <header className="panel-heading">
        <div>
          <h2 id={id}>{title}</h2>
          {description && <p>{description}</p>}
        </div>
      </header>
      <div className="section-body">{children}</div>
      {footer && <footer className="section-footer">{footer}</footer>}
    </section>
  );
}
