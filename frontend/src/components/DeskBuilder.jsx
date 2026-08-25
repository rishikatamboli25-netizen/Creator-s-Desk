import React, { useState } from "react";

const DeskBuilder = () => {
  const [formData, setFormData] = useState({
    useCase: [],
    budget: "",
    existingProducts: [],
    style: "minimal",
    priority: "performance",
  });

  const useCases = ["coding", "gaming", "content creation", "studying"];

  const handleUseCase = (useCase) => {
    setFormData((prev) => ({
      ...prev,
      useCase: prev.useCase.includes(useCase)
        ? prev.useCase.filter((item) => item !== useCase)
        : [...prev.useCase, useCase],
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    console.log("Desk Builder Request:", {
      useCase: formData.useCase,
      budget: Number(formData.budget),
      existingProducts: formData.existingProducts,
      preferences: {
        style: formData.style,
        priority: formData.priority,
      },
    });
  };

  return (
    <section className="min-h-screen bg-neutral-950 px-6 py-20 text-white">
      <div className="mx-auto max-w-4xl">

        {/* Header */}
        <div className="mb-12">
          <p className="mb-3 text-sm uppercase tracking-[0.3em] text-neutral-500">
            AI Desk Builder
          </p>

          <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
            Build your perfect desk.
          </h1>

          <p className="mt-4 max-w-2xl text-neutral-400">
            Tell us how you work, play, and what you already own.
            Our AI will design a setup around you.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-10">

          {/* Use Case */}
          <div>
            <label className="mb-4 block text-lg font-medium">
              What will you use your setup for?
            </label>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {useCases.map((useCase) => {
                const selected = formData.useCase.includes(useCase);

                return (
                  <button
                    key={useCase}
                    type="button"
                    onClick={() => handleUseCase(useCase)}
                    className={`rounded-xl border px-4 py-4 text-left capitalize transition ${
                      selected
                        ? "border-white bg-white text-black"
                        : "border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-600"
                    }`}
                  >
                    {useCase}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Budget */}
          <div>
            <label className="mb-4 block text-lg font-medium">
              What's your budget?
            </label>

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500">
                ₹
              </span>

              <input
                type="number"
                min="1"
                value={formData.budget}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    budget: e.target.value,
                  }))
                }
                placeholder="30000"
                className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-10 py-4 text-white outline-none transition placeholder:text-neutral-600 focus:border-neutral-500"
              />
            </div>
          </div>

          {/* Existing Products */}
          <div>
            <label className="mb-4 block text-lg font-medium">
              What do you already own?
            </label>

            <input
              type="text"
              placeholder="e.g. mouse, keyboard, monitor"
              value={formData.existingProducts.join(", ")}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  existingProducts: e.target.value
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean),
                }))
              }
              className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-4 text-white outline-none transition placeholder:text-neutral-600 focus:border-neutral-500"
            />

            <p className="mt-2 text-sm text-neutral-600">
              Separate multiple products with commas.
            </p>
          </div>

          {/* Style */}
          <div>
            <label className="mb-4 block text-lg font-medium">
              What's your preferred style?
            </label>

            <div className="flex flex-wrap gap-3">
              {["minimal", "premium", "gaming", "industrial"].map((style) => {
                const selected = formData.style === style;

                return (
                  <button
                    key={style}
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        style,
                      }))
                    }
                    className={`rounded-full border px-5 py-3 capitalize transition ${
                      selected
                        ? "border-white bg-white text-black"
                        : "border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-600"
                    }`}
                  >
                    {style}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="mb-4 block text-lg font-medium">
              What's most important to you?
            </label>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {["performance", "ergonomics", "aesthetics"].map((priority) => {
                const selected = formData.priority === priority;

                return (
                  <button
                    key={priority}
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        priority,
                      }))
                    }
                    className={`rounded-xl border px-4 py-4 capitalize transition ${
                      selected
                        ? "border-white bg-white text-black"
                        : "border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-600"
                    }`}
                  >
                    {priority}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full rounded-xl bg-white px-6 py-4 font-medium text-black transition hover:bg-neutral-200"
          >
            Build My Desk →
          </button>

        </form>
      </div>
    </section>
  );
};

export default DeskBuilder;