import os
import sqlite3

def migrate():
    db_path = os.path.join("data", "balicivilai.db")
    print(f"Connecting to {db_path}...")
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if column exists
        cursor.execute("PRAGMA table_info(issue)")
        columns = [info[1] for info in cursor.fetchall()]
        
        if 'timeline' not in columns:
            print("Adding timeline column...")
            try:
                # Adding as TEXT since SQLite JSON is stored as TEXT usually, 
                # and 'JSON' type might not be recognized in strict mode or older versions, 
                # though modern SQLite accepts it. Safest is JSON or TEXT.
                cursor.execute("ALTER TABLE issue ADD COLUMN timeline JSON")
                conn.commit()
                print("Column 'timeline' added successfully.")
            except Exception as e:
                print(f"Error adding column: {e}")
        else:
            print("Timeline column already exists.")
            
        conn.close()
    except Exception as e:
        print(f"Database connection error: {e}")

if __name__ == "__main__":
    migrate()
