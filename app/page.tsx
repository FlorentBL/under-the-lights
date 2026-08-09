import Image from "next/image";

export default function Home() {
  return (
    <main className="farewell-page">
      <Image
        className="farewell-backdrop"
        src="/beta-farewell.png"
        alt="An empty football stadium after the final match"
        fill
        sizes="100vw"
        priority
      />
      <div className="farewell-shade" aria-hidden="true" />

      <section className="farewell-content">
        <Image
          className="farewell-logo"
          src="/logo.png"
          alt="Soccerverse Under the Lights"
          width={1774}
          height={887}
          priority
        />
        <p className="farewell-status">The beta has ended</p>
        <h1>Thank you for playing.</h1>
        <p className="farewell-message">
          Thank you for every prediction, every conversation, and every night you shared with us under the lights.
        </p>
      </section>

      <footer className="farewell-footer">
        <span>Under the Lights</span>
        <span>Made with the Soccerverse community</span>
      </footer>
    </main>
  );
}
