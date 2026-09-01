import OptionCard from "./OptionCard";

export default function WelcomeScreen({ onSelect }) {
  return (
    <div className="space-y-8">

      {/* Intro */}

      <div className="space-y-3">

        <div className="inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700">
          AI Workspace Assistant
        </div>

        <div>
          <h2 className="text-2xl font-semibold text-gray-900">
            Hi, I'm Creator's Desk AI.
          </h2>

          <p className="mt-3 text-[15px] leading-7 text-gray-600">
            I'll help you build the perfect workspace based on your budget,
            workflow and the products you already own.
          </p>
        </div>

      </div>

      {/* Question */}

      <div>

        <h3 className="mb-4 text-base font-medium text-gray-900">
          What would you like to do today?
        </h3>

        <div className="space-y-3">

          <OptionCard
            number="1"
            title="Build a complete desk setup"
            subtitle="Start from scratch and let AI recommend everything."
            onClick={() =>
              onSelect("Build a complete desk setup")
            }
          />

          <OptionCard
            number="2"
            title="Improve my current setup"
            subtitle="Tell me what you already own and I'll build around it."
            onClick={() =>
              onSelect("Improve my current setup")
            }
          />

          <OptionCard
            number="3"
            title="Find products for a budget"
            subtitle="Get the best recommendations within your budget."
            onClick={() =>
              onSelect("Find products for a budget")
            }
          />

        </div>

      </div>

    </div>
  );
}