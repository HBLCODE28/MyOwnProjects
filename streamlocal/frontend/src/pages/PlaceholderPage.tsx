type PlaceholderPageProps = {
  title: string;
  stage: string;
  description: string;
};

export function PlaceholderPage({ title, stage, description }: PlaceholderPageProps) {
  return (
    <div className="page placeholder-page">
      <p className="eyebrow">{stage}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
