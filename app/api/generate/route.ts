export async function POST(request: Request) {
  const body = await request.json();

  console.log("Generate request body:", body);

  return Response.json({
    letter: "This is a placeholder cover letter.",
  });
}
