import socket
try:
    ip = socket.gethostbyname("ltzaolvyqxrqjqhveqet.supabase.co")
    print(f"Resolved to {ip}")
except Exception as e:
    print(f"Failed to resolve: {e}")
