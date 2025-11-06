export default function HomePage() {
  return (
    <div className="h-screen flex flex-col items-center justify-center text-center space-y-8">
      
      <h1 className="text-7xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-pink-500 bg-clip-text text-transparent animate-pulse">
        SONAR
      </h1>

      <p className="text-2xl text-cyan-300/80">Neural Music Identification</p>

      <p className="text-gray-400 italic">
        “Listen to the world. Let AI name the soundtrack.”
      </p>
    </div>
  );
}
