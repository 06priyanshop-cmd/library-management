import React, { useState, useEffect, useMemo, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  BookOpen,
  Users,
  LayoutDashboard,
  ArrowRightLeft,
  Search,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Library,
  Sparkles,
  X,
  Send,
  History,
  LogOut,
  BookMarked
} from "lucide-react";
import { GoogleGenAI } from "@google/genai";

// --- MOCK DATABASE TYPES ---
// These interfaces define our Schema, mimicking a SQL/NoSQL DB structure.

interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
  category: string;
  totalCopies: number;
  availableCopies: number;
  addedAt: string;
}

interface Student {
  id: string;
  name: string;
  rollNo: string;
  department: string;
  email: string;
  joinedAt: string;
}

interface Transaction {
  id: string;
  bookId: string;
  studentId: string;
  issueDate: string; // ISO String
  dueDate: string;   // ISO String
  returnDate?: string; // ISO String
  status: 'ISSUED' | 'RETURNED';
  fine: number;
}

// --- MOCK BACKEND SERVICE ---
// This acts as our API Layer and Database Controller.
// In a real app, these would be REST/GraphQL endpoints connecting to SQL/Mongo.

class LibraryService {
  private static STORAGE_KEYS = {
    BOOKS: 'lib_books',
    STUDENTS: 'lib_students',
    TRANSACTIONS: 'lib_transactions'
  };

  // Initialize DB with dummy data if empty
  static init() {
    if (!localStorage.getItem(this.STORAGE_KEYS.BOOKS)) {
      const dummyBooks: Book[] = [
        { id: 'b1', title: 'Introduction to Algorithms', author: 'Cormen, Leiserson', isbn: '9780262033848', category: 'Computer Science', totalCopies: 5, availableCopies: 5, addedAt: new Date().toISOString() },
        { id: 'b2', title: 'Clean Code', author: 'Robert C. Martin', isbn: '9780132350884', category: 'Software Engineering', totalCopies: 3, availableCopies: 3, addedAt: new Date().toISOString() },
        { id: 'b3', title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', isbn: '9780743273565', category: 'Fiction', totalCopies: 2, availableCopies: 2, addedAt: new Date().toISOString() },
        { id: 'b4', title: 'University Physics', author: 'Young and Freedman', isbn: '9780321696861', category: 'Physics', totalCopies: 8, availableCopies: 8, addedAt: new Date().toISOString() },
      ];
      localStorage.setItem(this.STORAGE_KEYS.BOOKS, JSON.stringify(dummyBooks));
    }

    if (!localStorage.getItem(this.STORAGE_KEYS.STUDENTS)) {
      const dummyStudents: Student[] = [
        { id: 's1', name: 'John Doe', rollNo: 'CS101', department: 'Computer Science', email: 'john@college.edu', joinedAt: new Date().toISOString() },
        { id: 's2', name: 'Jane Smith', rollNo: 'PH202', department: 'Physics', email: 'jane@college.edu', joinedAt: new Date().toISOString() },
      ];
      localStorage.setItem(this.STORAGE_KEYS.STUDENTS, JSON.stringify(dummyStudents));
    }

    if (!localStorage.getItem(this.STORAGE_KEYS.TRANSACTIONS)) {
      localStorage.setItem(this.STORAGE_KEYS.TRANSACTIONS, JSON.stringify([]));
    }
  }

  static getBooks(): Book[] {
    return JSON.parse(localStorage.getItem(this.STORAGE_KEYS.BOOKS) || '[]');
  }

  static getStudents(): Student[] {
    return JSON.parse(localStorage.getItem(this.STORAGE_KEYS.STUDENTS) || '[]');
  }

  static getTransactions(): Transaction[] {
    return JSON.parse(localStorage.getItem(this.STORAGE_KEYS.TRANSACTIONS) || '[]');
  }

  static addBook(book: Omit<Book, 'id' | 'availableCopies' | 'addedAt'>): Book {
    const books = this.getBooks();
    const newBook: Book = {
      ...book,
      id: crypto.randomUUID(),
      availableCopies: book.totalCopies,
      addedAt: new Date().toISOString()
    };
    books.push(newBook);
    localStorage.setItem(this.STORAGE_KEYS.BOOKS, JSON.stringify(books));
    return newBook;
  }

  static addStudent(student: Omit<Student, 'id' | 'joinedAt'>): Student {
    const students = this.getStudents();
    const newStudent: Student = {
      ...student,
      id: crypto.randomUUID(),
      joinedAt: new Date().toISOString()
    };
    students.push(newStudent);
    localStorage.setItem(this.STORAGE_KEYS.STUDENTS, JSON.stringify(students));
    return newStudent;
  }

  static issueBook(bookId: string, studentId: string): { success: boolean, message: string, transaction?: Transaction } {
    const books = this.getBooks();
    const bookIndex = books.findIndex(b => b.id === bookId);
    
    if (bookIndex === -1) return { success: false, message: 'Book not found' };
    if (books[bookIndex].availableCopies <= 0) return { success: false, message: 'Book not available' };

    // Transaction logic
    books[bookIndex].availableCopies--;
    
    const transaction: Transaction = {
      id: crypto.randomUUID(),
      bookId,
      studentId,
      issueDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days default
      status: 'ISSUED',
      fine: 0
    };

    const transactions = this.getTransactions();
    transactions.push(transaction);

    // Commit changes (ACID-ish)
    localStorage.setItem(this.STORAGE_KEYS.BOOKS, JSON.stringify(books));
    localStorage.setItem(this.STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));

    return { success: true, message: 'Book issued successfully', transaction };
  }

  static returnBook(transactionId: string): { success: boolean, message: string } {
    const transactions = this.getTransactions();
    const txnIndex = transactions.findIndex(t => t.id === transactionId);
    
    if (txnIndex === -1) return { success: false, message: 'Transaction not found' };
    if (transactions[txnIndex].status === 'RETURNED') return { success: false, message: 'Already returned' };

    const txn = transactions[txnIndex];
    const returnDate = new Date();
    const dueDate = new Date(txn.dueDate);
    
    // Calculate Fine ($1 per day overdue)
    let fine = 0;
    if (returnDate > dueDate) {
      const diffTime = Math.abs(returnDate.getTime() - dueDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      fine = diffDays * 1; 
    }

    // Update Transaction
    txn.returnDate = returnDate.toISOString();
    txn.status = 'RETURNED';
    txn.fine = fine;

    // Update Book Availability
    const books = this.getBooks();
    const bookIndex = books.findIndex(b => b.id === txn.bookId);
    if (bookIndex !== -1) {
      books[bookIndex].availableCopies++;
    }

    localStorage.setItem(this.STORAGE_KEYS.BOOKS, JSON.stringify(books));
    localStorage.setItem(this.STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));

    return { success: true, message: `Book returned. Fine: $${fine}` };
  }

  static deleteBook(id: string) {
    let books = this.getBooks();
    books = books.filter(b => b.id !== id);
    localStorage.setItem(this.STORAGE_KEYS.BOOKS, JSON.stringify(books));
  }

  static deleteStudent(id: string) {
    let students = this.getStudents();
    students = students.filter(s => s.id !== id);
    localStorage.setItem(this.STORAGE_KEYS.STUDENTS, JSON.stringify(students));
  }
}

// --- AI COMPONENT ---

const AILibrarian = ({ books }: { books: Book[] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([
    { role: 'model', text: 'Hello! I am your AI Librarian. Ask me anything about our collection or for book recommendations.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !process.env.API_KEY) return;
    
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Contextual RAG-lite: Injecting catalog into system prompt
      const catalogContext = books.map(b => 
        `Title: ${b.title}, Author: ${b.author}, Category: ${b.category}, ISBN: ${b.isbn}, Available: ${b.availableCopies}`
      ).join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: userMsg,
        config: {
          systemInstruction: `You are a helpful and knowledgeable librarian for a college library. 
          Here is the current library catalog:\n${catalogContext}\n
          
          Rules:
          1. If asked about availability, check the catalog data.
          2. Suggest books based on the catalog if possible, or general knowledge if we don't have it but recommend requesting it.
          3. Be polite and academic.
          4. Keep answers concise.`,
        }
      });
      
      setMessages(prev => [...prev, { role: 'model', text: response.text || "I couldn't process that request." }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: "Sorry, I'm having trouble connecting to the knowledge base right now." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 h-14 w-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-indigo-700 transition-all z-50"
      >
        {isOpen ? <X /> : <Sparkles />}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 h-[500px] bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden z-50 animate-in slide-in-from-bottom-5">
          <div className="bg-indigo-600 p-4 text-white flex items-center gap-2">
            <Library className="w-5 h-5" />
            <span className="font-semibold">AI Librarian</span>
          </div>
          
          <div className="flex-1 p-4 overflow-y-auto bg-slate-50" ref={scrollRef}>
            {messages.map((m, i) => (
              <div key={i} className={`mb-4 flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-lg text-sm ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-800 shadow-sm'}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && <div className="text-xs text-slate-400 text-center animate-pulse">Thinking...</div>}
          </div>

          <div className="p-3 bg-white border-t border-slate-100 flex gap-2">
            <input 
              type="text" 
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleSend()}
              placeholder="Ask about books..."
              className="flex-1 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button 
              onClick={handleSend}
              disabled={!process.env.API_KEY || loading}
              className="p-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};


// --- UI COMPONENTS ---

const Dashboard = ({ stats, transactions }: { stats: any, transactions: Transaction[] }) => (
  <div className="space-y-6">
    <h2 className="text-2xl font-bold text-slate-800">Dashboard Overview</h2>
    
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[
        { label: 'Total Books', value: stats.totalBooks, icon: BookOpen, color: 'bg-blue-500' },
        { label: 'Issued Books', value: stats.issuedBooks, icon: BookMarked, color: 'bg-orange-500' },
        { label: 'Active Students', value: stats.totalStudents, icon: Users, color: 'bg-green-500' },
        { label: 'Overdue Returns', value: stats.overdue, icon: AlertCircle, color: 'bg-red-500' },
      ].map((item, i) => (
        <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className={`p-3 rounded-lg ${item.color} text-white`}>
            <item.icon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500">{item.label}</p>
            <p className="text-2xl font-bold text-slate-800">{item.value}</p>
          </div>
        </div>
      ))}
    </div>

    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-6 border-b border-slate-100">
        <h3 className="text-lg font-semibold text-slate-800">Recent Transactions</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-xs uppercase font-medium">
            <tr>
              <th className="px-6 py-3">Trans ID</th>
              <th className="px-6 py-3">Book ID</th>
              <th className="px-6 py-3">Student ID</th>
              <th className="px-6 py-3">Issue Date</th>
              <th className="px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {transactions.slice().reverse().slice(0, 5).map((t) => (
              <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-6 py-4 font-mono text-xs">{t.id.slice(0, 8)}...</td>
                <td className="px-6 py-4">{t.bookId}</td>
                <td className="px-6 py-4">{t.studentId}</td>
                <td className="px-6 py-4">{new Date(t.issueDate).toLocaleDateString()}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    t.status === 'ISSUED' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {t.status}
                  </span>
                </td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">No transactions recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

const BooksView = ({ books, onAdd, onDelete }: { books: Book[], onAdd: any, onDelete: any }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  
  const filteredBooks = books.filter(b => 
    b.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    b.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const AddBookModal = () => {
    const [formData, setFormData] = useState({ title: '', author: '', isbn: '', category: '', totalCopies: 1 });
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
          <h3 className="text-xl font-bold mb-4">Add New Book</h3>
          <div className="space-y-3">
            <input className="w-full p-2 border rounded" placeholder="Title" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
            <input className="w-full p-2 border rounded" placeholder="Author" value={formData.author} onChange={e => setFormData({...formData, author: e.target.value})} />
            <div className="grid grid-cols-2 gap-3">
              <input className="w-full p-2 border rounded" placeholder="ISBN" value={formData.isbn} onChange={e => setFormData({...formData, isbn: e.target.value})} />
              <input className="w-full p-2 border rounded" placeholder="Category" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} />
            </div>
            <input className="w-full p-2 border rounded" type="number" placeholder="Copies" value={formData.totalCopies} onChange={e => setFormData({...formData, totalCopies: parseInt(e.target.value)})} />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Cancel</button>
            <button onClick={() => { onAdd(formData); setShowModal(false); }} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Add Book</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Book Catalog</h2>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" /> Add Book
        </button>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by title, author, or category..." 
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 uppercase font-medium">
            <tr>
              <th className="px-6 py-3">Title / ISBN</th>
              <th className="px-6 py-3">Author</th>
              <th className="px-6 py-3">Category</th>
              <th className="px-6 py-3 text-center">Availability</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredBooks.map(book => (
              <tr key={book.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-6 py-4">
                  <div className="font-semibold text-slate-900">{book.title}</div>
                  <div className="text-xs text-slate-400 font-mono">{book.isbn}</div>
                </td>
                <td className="px-6 py-4">{book.author}</td>
                <td className="px-6 py-4"><span className="px-2 py-1 bg-slate-100 rounded text-xs">{book.category}</span></td>
                <td className="px-6 py-4 text-center">
                  <span className={`font-bold ${book.availableCopies > 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {book.availableCopies}
                  </span> / {book.totalCopies}
                </td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => onDelete(book.id)} className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showModal && <AddBookModal />}
    </div>
  );
};

const StudentsView = ({ students, onAdd, onDelete }: { students: Student[], onAdd: any, onDelete: any }) => {
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.rollNo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const AddStudentModal = () => {
    const [formData, setFormData] = useState({ name: '', rollNo: '', department: '', email: '' });
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
          <h3 className="text-xl font-bold mb-4">Register Student</h3>
          <div className="space-y-3">
            <input className="w-full p-2 border rounded" placeholder="Full Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            <input className="w-full p-2 border rounded" placeholder="Roll Number" value={formData.rollNo} onChange={e => setFormData({...formData, rollNo: e.target.value})} />
            <input className="w-full p-2 border rounded" placeholder="Department" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} />
            <input className="w-full p-2 border rounded" placeholder="Email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Cancel</button>
            <button onClick={() => { onAdd(formData); setShowModal(false); }} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Student Directory</h2>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Add Student
        </button>
      </div>
      
      <div className="relative max-w-md mb-6">
          <Search className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search students..." 
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 uppercase font-medium">
            <tr>
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">Roll No</th>
              <th className="px-6 py-3">Department</th>
              <th className="px-6 py-3">Email</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map(student => (
              <tr key={student.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-6 py-4 font-semibold text-slate-900">{student.name}</td>
                <td className="px-6 py-4 font-mono">{student.rollNo}</td>
                <td className="px-6 py-4">{student.department}</td>
                <td className="px-6 py-4">{student.email}</td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => onDelete(student.id)} className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showModal && <AddStudentModal />}
    </div>
  );
};

const CirculationView = ({ books, students, transactions, onIssue, onReturn }: any) => {
  const [activeTab, setActiveTab] = useState<'issue' | 'return'>('issue');
  
  // Issue Form State
  const [selectedBook, setSelectedBook] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');

  // Return Form State (Active Transactions)
  const activeTransactions = transactions.filter((t: Transaction) => t.status === 'ISSUED');

  const handleIssue = () => {
    if(!selectedBook || !selectedStudent) return;
    onIssue(selectedBook, selectedStudent);
    setSelectedBook('');
    setSelectedStudent('');
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Circulation Desk</h2>

      <div className="flex gap-4 border-b border-slate-200">
        <button 
          className={`pb-2 px-4 font-medium ${activeTab === 'issue' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}
          onClick={() => setActiveTab('issue')}
        >
          Issue Book
        </button>
        <button 
          className={`pb-2 px-4 font-medium ${activeTab === 'return' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}
          onClick={() => setActiveTab('return')}
        >
          Return Book
        </button>
      </div>

      {activeTab === 'issue' ? (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100 max-w-2xl">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Select Student</label>
              <select 
                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                value={selectedStudent}
                onChange={e => setSelectedStudent(e.target.value)}
              >
                <option value="">-- Choose Student --</option>
                {students.map((s: Student) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.rollNo})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Select Book</label>
              <select 
                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                value={selectedBook}
                onChange={e => setSelectedBook(e.target.value)}
              >
                <option value="">-- Choose Book --</option>
                {books.filter((b: Book) => b.availableCopies > 0).map((b: Book) => (
                  <option key={b.id} value={b.id}>{b.title} (Avail: {b.availableCopies})</option>
                ))}
              </select>
            </div>
            <button 
              onClick={handleIssue}
              disabled={!selectedBook || !selectedStudent}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirm Issue
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
           <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 uppercase font-medium">
              <tr>
                <th className="px-6 py-3">Book</th>
                <th className="px-6 py-3">Student</th>
                <th className="px-6 py-3">Issue Date</th>
                <th className="px-6 py-3">Due Date</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {activeTransactions.map((t: Transaction) => {
                const book = books.find((b: Book) => b.id === t.bookId);
                const student = students.find((s: Student) => s.id === t.studentId);
                const isOverdue = new Date() > new Date(t.dueDate);
                return (
                  <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium">{book?.title || 'Unknown Book'}</td>
                    <td className="px-6 py-4">{student?.name || 'Unknown Student'}</td>
                    <td className="px-6 py-4">{new Date(t.issueDate).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-red-600 font-medium">{new Date(t.dueDate).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      {isOverdue ? (
                        <span className="text-red-600 bg-red-100 px-2 py-1 rounded text-xs">Overdue</span>
                      ) : (
                        <span className="text-green-600 bg-green-100 px-2 py-1 rounded text-xs">Active</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => onReturn(t.id)}
                        className="px-3 py-1 bg-slate-800 text-white rounded hover:bg-slate-900 text-xs"
                      >
                        Return
                      </button>
                    </td>
                  </tr>
                );
              })}
              {activeTransactions.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">No active borrowed books.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// --- MAIN APP COMPONENT ---

const App = () => {
  const [view, setView] = useState<'dashboard' | 'books' | 'students' | 'circulation'>('dashboard');
  const [books, setBooks] = useState<Book[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  // Load Data
  const refreshData = () => {
    setBooks(LibraryService.getBooks());
    setStudents(LibraryService.getStudents());
    setTransactions(LibraryService.getTransactions());
  };

  useEffect(() => {
    LibraryService.init();
    refreshData();
  }, []);

  const showNotification = (msg: string, type: 'success' | 'error') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Stats Logic
  const stats = useMemo(() => {
    const overdue = transactions.filter(t => t.status === 'ISSUED' && new Date() > new Date(t.dueDate)).length;
    const issuedBooks = transactions.filter(t => t.status === 'ISSUED').length;
    return {
      totalBooks: books.reduce((acc, b) => acc + b.totalCopies, 0),
      issuedBooks,
      totalStudents: students.length,
      overdue
    };
  }, [books, students, transactions]);

  // Handlers
  const handleAddBook = (book: any) => {
    LibraryService.addBook(book);
    refreshData();
    showNotification('Book added successfully!', 'success');
  };

  const handleDeleteBook = (id: string) => {
    if(window.confirm('Are you sure you want to remove this book?')) {
      LibraryService.deleteBook(id);
      refreshData();
      showNotification('Book deleted.', 'success');
    }
  };

  const handleAddStudent = (student: any) => {
    LibraryService.addStudent(student);
    refreshData();
    showNotification('Student registered successfully!', 'success');
  };

  const handleDeleteStudent = (id: string) => {
    if(window.confirm('Are you sure? This will delete student history.')) {
      LibraryService.deleteStudent(id);
      refreshData();
      showNotification('Student removed.', 'success');
    }
  };

  const handleIssueBook = (bookId: string, studentId: string) => {
    const result = LibraryService.issueBook(bookId, studentId);
    if (result.success) {
      refreshData();
      showNotification(result.message, 'success');
    } else {
      showNotification(result.message, 'error');
    }
  };

  const handleReturnBook = (txnId: string) => {
    const result = LibraryService.returnBook(txnId);
    if (result.success) {
      refreshData();
      showNotification(result.message, 'success');
    } else {
      showNotification(result.message, 'error');
    }
  };

  return (
    <div className="flex h-screen bg-slate-50">
      {/* SIDEBAR */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col">
        <div className="p-6 flex items-center gap-3 text-white border-b border-slate-800">
          <Library className="w-8 h-8 text-blue-500" />
          <h1 className="font-bold text-xl tracking-tight">LibMaster</h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setView('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view === 'dashboard' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}
          >
            <LayoutDashboard className="w-5 h-5" /> Dashboard
          </button>
          <button 
            onClick={() => setView('books')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view === 'books' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}
          >
            <BookOpen className="w-5 h-5" /> Books
          </button>
          <button 
            onClick={() => setView('students')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view === 'students' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}
          >
            <Users className="w-5 h-5" /> Students
          </button>
          <button 
            onClick={() => setView('circulation')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${view === 'circulation' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}
          >
            <ArrowRightLeft className="w-5 h-5" /> Circulation
          </button>
        </nav>

        <div className="p-6 border-t border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">A</div>
            <div>
              <p className="text-sm font-medium text-white">Admin User</p>
              <p className="text-xs text-slate-500">Librarian</p>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
          <h2 className="text-lg font-semibold text-slate-700 capitalize">{view}</h2>
          <div className="flex items-center gap-4">
             <div className="text-xs text-slate-400 px-3 py-1 bg-slate-100 rounded-full">System v1.0.0</div>
          </div>
        </header>

        <div className="p-8">
          {view === 'dashboard' && <Dashboard stats={stats} transactions={transactions} />}
          {view === 'books' && <BooksView books={books} onAdd={handleAddBook} onDelete={handleDeleteBook} />}
          {view === 'students' && <StudentsView students={students} onAdd={handleAddStudent} onDelete={handleDeleteStudent} />}
          {view === 'circulation' && <CirculationView books={books} students={students} transactions={transactions} onIssue={handleIssueBook} onReturn={handleReturnBook} />}
        </div>
      </main>

      {/* NOTIFICATION TOAST */}
      {notification && (
        <div className={`fixed top-6 right-6 px-6 py-4 rounded-lg shadow-xl text-white flex items-center gap-3 animate-in slide-in-from-top-5 ${notification.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {notification.msg}
        </div>
      )}

      {/* AI LIBRARIAN WIDGET */}
      <AILibrarian books={books} />
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
