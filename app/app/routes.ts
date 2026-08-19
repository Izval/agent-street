import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("aisle/:id", "routes/aisle.tsx"),
  route("category/:id", "routes/category.tsx"),
  route("agent/:id", "routes/agent.tsx"),
  route("skills", "routes/skills.tsx"),
  route("skill/:id", "routes/skill.tsx"),
  route("hire", "routes/hire.tsx"),
  route("search", "routes/search.tsx"),
] satisfies RouteConfig;
